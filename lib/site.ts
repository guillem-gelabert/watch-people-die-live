// The one place that knows where the story is published.
//
// Metadata is the reason this has to exist. `canonical`, the hreflang set and the social card
// image are all written as site-relative paths, and a relative href is not a valid canonical or
// hreflang — a crawler that cannot resolve them ignores them, which is exactly what Lighthouse
// was reporting. Next resolves those paths against `metadataBase`, so naming the origin once here
// makes every one of them absolute without any caller having to build a URL.
//
// Overridable by env so a preview deploy advertises itself rather than production.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://watchpeopledie.live";

// The absolute form of a site-relative path. Only the places Next does not resolve for us —
// robots, the sitemap, the JSON-LD graph — need this; everything under `metadata` gets it free.
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}
