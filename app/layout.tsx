import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Libre_Baskerville, Public_Sans } from "next/font/google";
import type { ReactNode } from "react";

// Display face for headings, chapter titles and the proxy strips. Single weight by design.
const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bebas-neue",
  display: "swap",
});

// Body serif for the reading column.
const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-libre-baskerville",
  display: "swap",
});

// UI sans: captions, micro labels, chart ticks, controls.
const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-public-sans",
  display: "swap",
});

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

// `viewportFit: cover` lets the sticky stage and the pull-up bar reach under the notch and
// the home indicator; everything inside them pads with env(safe-area-inset-*). themeColor
// matches the opening sky so the browser chrome does not flash a different colour on load.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000011",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${libreBaskerville.variable} ${publicSans.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
