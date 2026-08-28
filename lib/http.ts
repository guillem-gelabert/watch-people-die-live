// Every outbound API call in this project goes through politeFetch. It exists because the ACLED
// build path did none of this and got the Railway builder blocked: six landing pages fetched
// concurrently, a retry loop that treated HTTP 403 as worth trying twice more, and no token reuse,
// so a failing build fired three OAuth POSTs and a passing one authenticated twice. Seven builds in
// four hours later, acleddata.com stopped answering that IP while the same credentials kept working
// from a laptop.
//
// Three rules, applied per host rather than per call site, because a remote service rate-limits the
// caller and neither knows nor cares which of our modules is talking:
//
//   1. Calls to one host are serialised and spaced by at least its minimum interval.
//   2. Retries are exponential, honour Retry-After, and happen only for failures that retrying can
//      actually fix — network errors, timeouts, 429 and 5xx.
//   3. A 4xx that is not 429 is the server saying the request itself is wrong. It is thrown
//      immediately: repeating it cannot help and is exactly what looks like abuse.
//
// Response and token caching stays with the callers, which know what is cacheable and for how long.

const DEFAULT_TIMEOUT_MS = 30_000;
// Long enough that a slow host does not trip the breaker, short enough that a genuine block is not
// retried for a full minute before the build hears about it.
const MAX_BACKOFF_MS = 30_000;
const MAX_RETRY_AFTER_MS = 60_000;

interface HostPolicy {
  minIntervalMs: number;
  attempts: number;
}

// Spacing is set by what each host publishes, or by what its behaviour has already taught us.
const HOST_POLICY: Record<string, HostPolicy> = {
  // Blocked the builder once. One second between calls turns the six-landing-page burst into a
  // six-second walk, which costs a build nothing and no longer arrives as a spike.
  "acleddata.com": { minIntervalMs: 1_000, attempts: 3 },
  // Free tier is 45 requests a minute, enforced by ban rather than by 429.
  "ip-api.com": { minIntervalMs: 1_400, attempts: 2 },
  "api.worldbank.org": { minIntervalMs: 250, attempts: 3 },
  "population.un.org": { minIntervalMs: 250, attempts: 4 },
  "xmart-api-public.who.int": { minIntervalMs: 250, attempts: 4 },
  // A CDN built to be hit hard; spacing here would only slow the build down.
  "raw.githubusercontent.com": { minIntervalMs: 0, attempts: 3 },
};

const DEFAULT_POLICY: HostPolicy = { minIntervalMs: 250, attempts: 3 };

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message?: string,
  ) {
    super(message ?? `HTTP ${status} from ${url}`);
    this.name = "HttpError";
  }
}

// Thrown instead of waiting when a caller cannot afford the queue — a page request would rather
// degrade than hold a response open behind someone else's rate limit.
export class RateLimitedError extends Error {
  constructor(
    readonly host: string,
    readonly waitMs: number,
  ) {
    super(`${host} is rate-limited locally; would have waited ${waitMs}ms`);
    this.name = "RateLimitedError";
  }
}

export interface PoliteFetchOptions {
  timeoutMs?: number;
  // Overrides the host policy. 1 disables retrying entirely.
  attempts?: number;
  minIntervalMs?: number;
  // Give up rather than queue when the wait would exceed this. Used on the request path.
  maxWaitMs?: number;
  // Prefixes thrown errors, so a failure names the source rather than a URL.
  label?: string;
  // Return the Response whatever its status. For diagnostics that report on a failure rather than
  // recover from it — they still queue and space like everything else.
  acceptAnyStatus?: boolean;
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const lastCallAt = new Map<string, number>();
const hostQueue = new Map<string, Promise<unknown>>();
// Set when a host says 429 or blocks us outright, so the calls already queued behind it back off
// too instead of each discovering the same wall.
const cooldownUntil = new Map<string, number>();

function policyFor(host: string): HostPolicy {
  return HOST_POLICY[host] ?? DEFAULT_POLICY;
}

function pendingWaitMs(host: string, minIntervalMs: number): number {
  const sinceLast = Date.now() - (lastCallAt.get(host) ?? 0);
  const spacing = Math.max(0, minIntervalMs - sinceLast);
  const cooldown = Math.max(0, (cooldownUntil.get(host) ?? 0) - Date.now());
  return Math.max(spacing, cooldown);
}

// One promise chain per host. Serialising is the point: six concurrent fetches to one host are six
// requests in the same millisecond no matter what the interval between them is nominally set to.
function schedule<T>(host: string, minIntervalMs: number, task: () => Promise<T>): Promise<T> {
  const prior = hostQueue.get(host) ?? Promise.resolve();
  const run = prior.then(async () => {
    const wait = pendingWaitMs(host, minIntervalMs);
    if (wait > 0) await sleep(wait);
    lastCallAt.set(host, Date.now());
    return task();
  });
  // The chain has to survive a rejection, or one failed call strands every later call behind it.
  hostQueue.set(
    host,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

// Seconds, or an HTTP-date. Anything else is treated as absent rather than guessed at.
function retryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.min(Math.max(0, date - Date.now()), MAX_RETRY_AFTER_MS);
}

function backoffMs(attempt: number): number {
  const exponential = Math.min(500 * 2 ** (attempt - 1), MAX_BACKOFF_MS);
  // Jitter so that parallel builds do not line up on the same retry beat.
  return exponential + Math.random() * 250;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

// A rejected build should say what the server actually replied, not just the number. Failure to
// read the body must never mask the status it was explaining.
async function bodySnippet(response: Response): Promise<string> {
  try {
    const text = (await response.text()).trim().slice(0, 300);
    return text ? `\n${text}` : "";
  } catch {
    return "";
  }
}

export async function politeFetch(
  url: string,
  init: RequestInit = {},
  options: PoliteFetchOptions = {},
): Promise<Response> {
  const host = new URL(url).host;
  const policy = policyFor(host);
  const minIntervalMs = options.minIntervalMs ?? policy.minIntervalMs;
  const attempts = options.attempts ?? policy.attempts;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const what = options.label ?? url;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (options.maxWaitMs !== undefined) {
      const wait = pendingWaitMs(host, minIntervalMs);
      if (wait > options.maxWaitMs) throw new RateLimitedError(host, wait);
    }

    let response: Response;
    try {
      response = await schedule(host, minIntervalMs, () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        return fetch(url, { ...init, signal: controller.signal, cache: "no-store" }).finally(() =>
          clearTimeout(timeout),
        );
      });
    } catch (error) {
      // A thrown fetch is a network fault or our own timeout, both of which retrying can fix.
      lastError = error;
      if (attempt < attempts) await sleep(backoffMs(attempt));
      continue;
    }

    if (response.ok || options.acceptAnyStatus) return response;

    if (!isRetryableStatus(response.status)) {
      // 401/403 here is the whole reason this module exists. Fail once, loudly.
      if (response.status === 401 || response.status === 403) {
        cooldownUntil.set(host, Date.now() + minIntervalMs * 4);
      }
      throw new HttpError(
        response.status,
        url,
        `${what} returned HTTP ${response.status}${await bodySnippet(response)}`,
      );
    }

    const after = retryAfterMs(response.headers.get("retry-after"));
    if (response.status === 429) {
      cooldownUntil.set(host, Date.now() + (after ?? backoffMs(attempt)));
    }
    lastError = new HttpError(response.status, url, `${what} returned HTTP ${response.status}`);
    if (attempt < attempts) await sleep(after ?? backoffMs(attempt));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${what} failed after ${attempts} attempts`);
}

// Convenience for the common case. Kept separate so streaming callers still get the Response.
export async function politeFetchJson<T>(
  url: string,
  init: RequestInit = {},
  options: PoliteFetchOptions = {},
): Promise<T> {
  const response = await politeFetch(url, init, options);
  return (await response.json()) as T;
}
