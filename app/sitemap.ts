import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

// One canonical URL. The locale is auto-detected from the Accept-Language header based on
// the reader's browser or OS language: Spanish/Catalan → Catalan, German → German, else English.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: absoluteUrl("/"),
      changeFrequency: "monthly" as const,
      priority: 1,
    },
  ];
}
