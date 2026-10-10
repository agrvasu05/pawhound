import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { ADSENSE_CLIENT } from "@/lib/ads";
import { GA_ID } from "@/lib/analytics";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  variable: "--font-fraunces",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://valuefindsdaily.com"
  ),
  title: {
    default: "Value Finds Daily — Cozy Home Ideas & Printables",
    template: "%s | Value Finds Daily",
  },
  description:
    "Cozy home decor ideas, small-space organization guides, and printable wall art & planners you can download instantly.",
  openGraph: { type: "website", siteName: "Value Finds Daily" },
  twitter: { card: "summary_large_image" },
  other: {
    "p:domain_verify": process.env.NEXT_PUBLIC_PINTEREST_VERIFY_TAG || "96f16459b5cd61b93a785297079749a6",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <head>
        {/* AdSense site verification without loading 250 KB of ad code up
            front; the ad script itself loads after the page is idle. */}
        {ADSENSE_CLIENT && <meta name="google-adsense-account" content={ADSENSE_CLIENT} />}
        {GA_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`,
              }}
            />
          </>
        )}
      </head>
      <body className="flex min-h-screen flex-col bg-white text-stone-900 antialiased">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        {ADSENSE_CLIENT && (
          <Script
            id="adsbygoogle-loader"
            strategy="lazyOnload"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        )}
      </body>
    </html>
  );
}
