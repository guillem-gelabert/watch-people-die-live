/** @type {import('next').NextConfig} */

// Everything under public/ is served by Next with `cache-control: public, max-age=0`, which means
// a conditional request per file per visit. This page asks for around twenty of them — the grids,
// the seasonality set, the two topologies — so a reader who has the whole story in cache still
// pays twenty round trips to the one region the app runs in before a single chart can draw.
//
// None of these filenames are content-hashed, so nothing here is `immutable`: a redeploy that
// rebakes the grids has to be able to reach readers. The split is by how often the bytes actually
// change. `stale-while-revalidate` is what makes the difference invisible either way — past the
// fresh window the cached copy still renders immediately and the refetch happens behind it.
const CACHE = {
  // Rebuilt whenever the notebooks are re-run, which is a deliberate act and a rare one. An hour
  // fresh collapses the twenty round trips within a session and across a same-day return visit;
  // the day of stale-while-revalidate means a redeploy is picked up one navigation later rather
  // than blocking this one.
  data: "public, max-age=3600, stale-while-revalidate=86400",
  // Texture maps of the Earth. These change when the planet does.
  texture: "public, max-age=2592000, stale-while-revalidate=31536000",
};

const nextConfig = {
  // The version of the framework serving a page is not the reader's business and not worth the
  // header on every response.
  poweredByHeader: false,

  async headers() {
    return [
      {
        // Applies to the files in public/data. /data/countries-110m.json is a route handler
        // (it reads the topology out of node_modules) and sets its own header, which wins.
        source: "/data/:path*",
        headers: [{ key: "Cache-Control", value: CACHE.data }],
      },
      {
        source: "/:dir(earth|maps)/:path*",
        headers: [{ key: "Cache-Control", value: CACHE.texture }],
      },
      {
        source: "/:path*",
        headers: [
          // Railway terminates TLS and the custom domain is HTTPS-only, so the only thing left to
          // close is the first plaintext request a browser makes before it has been told.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // The data layer is a pile of .json served from public/; none of it should ever be
          // sniffed into something executable.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Full URL to same-origin, bare origin to anyone else. The path carries `?lang=`, which
          // is not sensitive, but there is no reason to hand a third party the reader's exact URL.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nothing here is meant to be framed, and the globe is the kind of thing that gets
          // lifted into someone else's page. CSP's frame-ancestors is the modern spelling;
          // X-Frame-Options is kept for the browsers that only read that one.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
