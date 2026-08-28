// The rules that got the builder blocked are the ones worth pinning: a 403 must cost exactly one
// request, and concurrent calls to one host must not arrive together.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError, politeFetch, RateLimitedError } from "./http";

const originalFetch = globalThis.fetch;

function respond(status: number, body = "", headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers });
}

describe("politeFetch", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("does not retry a 403 — the amplification that got ACLED to block the build", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(403, "Forbidden"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      politeFetch("https://acleddata.com/oauth/token", {}, { label: "ACLED OAuth" }),
    ).rejects.toBeInstanceOf(HttpError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("carries the status and the response body into the error", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(respond(400, "bad indicator")) as unknown as typeof fetch;

    const error = await politeFetch("https://api.worldbank.org/v2/x", {}, { label: "WB" }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(400);
    expect((error as HttpError).message).toContain("WB returned HTTP 400");
    expect((error as HttpError).message).toContain("bad indicator");
  });

  it("retries a 500 and returns the eventual success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(500))
      .mockResolvedValueOnce(respond(200, "ok"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await politeFetch(
      "https://population.un.org/dataportalapi/api/v1/x",
      {},
      { minIntervalMs: 0 },
    );

    expect(await response.text()).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("spaces concurrent calls to one host instead of firing them together", async () => {
    const startedAt: number[] = [];
    globalThis.fetch = vi.fn(() => {
      startedAt.push(Date.now());
      return Promise.resolve(respond(200, "ok"));
    }) as unknown as typeof fetch;

    // Six landing pages, the exact shape of the ACLED burst.
    await Promise.all(
      Array.from({ length: 3 }, () =>
        politeFetch("https://example.test/page", {}, { minIntervalMs: 40 }),
      ),
    );

    expect(startedAt).toHaveLength(3);
    let previous = startedAt[0] ?? 0;
    for (const at of startedAt.slice(1)) {
      // Timer slack, not the full interval: the assertion is "spaced", not "spaced exactly".
      expect(at - previous).toBeGreaterThanOrEqual(30);
      previous = at;
    }
  });

  it("gives up rather than queueing when the caller cannot wait", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(respond(200, "ok"))) as unknown as typeof fetch;

    const host = "https://slow.test/x";
    await politeFetch(host, {}, { minIntervalMs: 5_000 });

    // The next call would have to wait out the interval, which a request path will not do.
    await expect(
      politeFetch(host, {}, { minIntervalMs: 5_000, maxWaitMs: 50 }),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });

  it("honours Retry-After on a 429", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(429, "", { "retry-after": "0" }))
      .mockResolvedValueOnce(respond(200, "ok"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await politeFetch("https://limited.test/x", {}, { minIntervalMs: 0 });

    expect(await response.text()).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns a non-2xx untouched when the caller is a probe", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(respond(503, "down")) as unknown as typeof fetch;

    const response = await politeFetch(
      "https://api.worldbank.org/v2/probe",
      {},
      { attempts: 1, acceptAnyStatus: true },
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("down");
  });
});
