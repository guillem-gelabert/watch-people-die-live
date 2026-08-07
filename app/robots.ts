import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

// The story is one page and wants to be found, so the only thing worth saying here is "yes, and
// the sitemap is over there". `/api/` is disallowed rather than hidden: those routes answer with
// JSON that only the page itself has any use for, and a crawler spending its budget on
// /api/conflicts is a crawler not reading the story.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
