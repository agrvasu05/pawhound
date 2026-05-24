import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://valuefindsdaily.com"
  ),
  title: {
    default: "Value Finds Daily — Dog Breed Guides",
    template: "%s | Value Finds Daily",
  },
  description:
    "Honest dog breed guides for every kind of household. Find the breed that fits your actual life.",
  openGraph: { type: "website", siteName: "Value Finds Daily" },
  twitter: { card: "summary_large_image" },
  other: {
    "p:domain_verify": process.env.NEXT_PUBLIC_PINTEREST_VERIFY_TAG || "",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {process.env.NEXT_PUBLIC_ADSTERRA_SOCIAL_BAR_ID && (
          <Script
            id="adsterra-social"
            strategy="afterInteractive"
            src={`//pl${process.env.NEXT_PUBLIC_ADSTERRA_SOCIAL_BAR_ID}.profitableratecpm.com/invoke.js`}
            data-cfasync="false"
          />
        )}
        {process.env.NEXT_PUBLIC_ADSTERRA_POPUNDER_ID && (
          <Script
            id="adsterra-pop"
            strategy="afterInteractive"
            src={`//pl${process.env.NEXT_PUBLIC_ADSTERRA_POPUNDER_ID}.profitableratecpm.com/invoke.js`}
            data-cfasync="false"
          />
        )}
      </head>
      <body className="bg-stone-50 text-stone-900 antialiased">{children}</body>
    </html>
  );
}
