import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    formats: ["image/avif", "image/webp"],
  },
  // Never bundle /public into the Netlify serverless function — it's served
  // from the CDN. Without this, the attribution page's fs.readdirSync over
  // public/images/breeds made Next trace ALL images (234 MB — and public/pins
  // grows daily) into the function, blowing Netlify's 250 MB limit. Pages that
  // fs-read public/ (attribution) render fully at build time; a runtime
  // re-render just falls back to their empty state.
  outputFileTracingExcludes: {
    "/*": ["./public/**"],
  },
};

export default nextConfig;
