import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Watch People Die Live",
  description:
    "A real-time statistical mortality globe: each flash is modeled from public death-rate, population-density, and demographic data, with representative personas rather than individual records.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: "Watch People Die Live",
    description:
      "A real-time statistical mortality globe built from public demographic data. Each persona is representative, not an identifiable individual.",
    url: "/",
    images: [{ url: "/social-preview.png", width: 1200, height: 630 }],
    siteName: "Watch People Die Live",
  },
  twitter: {
    card: "summary_large_image",
    title: "Watch People Die Live",
    description:
      "A statistical mortality globe with representative personas, not individual death records.",
    images: ["/social-preview.png"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
