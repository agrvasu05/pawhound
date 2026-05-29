import type { Metadata } from "next";
import Script from "next/script";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

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
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <head>
        {process.env.NEXT_PUBLIC_ADSTERRA_SOCIAL_BAR_ID && (
          <Script
            id="adsterra-social"
            strategy="afterInteractive"
            src={`https://pl${process.env.NEXT_PUBLIC_ADSTERRA_SOCIAL_BAR_ID}.profitableratecpm.com/invoke.js`}
            data-cfasync="false"
          />
        )}
        {process.env.NEXT_PUBLIC_ADSTERRA_POPUNDER_ID && (
          <Script
            id="adsterra-pop"
            strategy="afterInteractive"
            src={`https://pl${process.env.NEXT_PUBLIC_ADSTERRA_POPUNDER_ID}.profitableratecpm.com/invoke.js`}
            data-cfasync="false"
          />
        )}
      </head>
      <body className="flex min-h-screen flex-col bg-white text-stone-900 antialiased">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
