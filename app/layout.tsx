import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Libre_Baskerville, Public_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/site";

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

// Nothing here depends on the reader's language, and everything that once did — title,
// description, the social cards, the canonical and the hreflang set — now comes from the page's
// own generateMetadata, which is the only place that can see `?lang=`.
//
// `metadataBase` is the exception, and it belongs here because it is the same for every language.
// generateMetadata writes its canonical, its hreflang set and its card image as site-relative
// paths; without a base Next emits them relative, and a relative `rel=canonical` or `hreflang` is
// not resolvable by a crawler that arrived from anywhere else. This is what turns all of them
// absolute in one place.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Watch People Die Live",
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
  // A layout cannot see the search params the locale rides in, so this is the source language;
  // I18nProvider corrects it on the client as soon as the story mounts.
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${libreBaskerville.variable} ${publicSans.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
