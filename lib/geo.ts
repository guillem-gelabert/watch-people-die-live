// Best-effort IP geolocation, ported from the old Express server. Lets the client
// center the globe on the viewer. Response shape unchanged: {lat,lon,name,source}.

const GEO_TTL_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20000;

export interface GeoPayload {
  lat: number | null;
  lon: number | null;
  name: string | null;
  source: "none" | "ip-api";
}

const geoCache = new Map<string, { payload: GeoPayload; ts: number }>();

export function clientIpFromHeaders(headers: Headers): string {
  const xff = headers.get("x-forwarded-for"); // set by Railway's proxy to the real client
  const ip = (xff ? xff.split(",")[0] : "") ?? "";
  return ip.trim().replace(/^::ffff:/, ""); // unwrap IPv4-mapped IPv6
}

function isPrivateIp(ip: string): boolean {
  return (
    !ip ||
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

interface IpApiResponse {
  status: "success" | "fail";
  lat?: number;
  lon?: number;
  country?: string;
  city?: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function geolocate(ip: string): Promise<GeoPayload> {
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.ts < GEO_TTL_MS) return cached.payload;
  let payload: GeoPayload = { lat: null, lon: null, name: null, source: "none" };
  try {
    // Omit the IP for local/private callers (dev) so ip-api uses the requester IP it
    // sees. ip-api free is HTTP-only, which is fine for a server-side call.
    const path = isPrivateIp(ip) ? "" : encodeURIComponent(ip);
    const data = await fetchJson<IpApiResponse>(
      `http://ip-api.com/json/${path}?fields=status,lat,lon,country,city`,
    );
    if (data && data.status === "success" && Number.isFinite(data.lat)) {
      payload = {
        lat: data.lat as number,
        lon: data.lon as number,
        name: data.city ? `${data.city}, ${data.country}` : data.country || null,
        source: "ip-api",
      };
    }
  } catch (err) {
    console.error("Geo lookup failed:", err instanceof Error ? err.message : err);
  }
  geoCache.set(ip, { payload, ts: Date.now() });
  return payload;
}
