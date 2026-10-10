import type { NextConfig } from "next";

// Static export: the whole site is plain HTML/JS/CSS in ./out, built in GitHub
// Actions and uploaded to Cloudflare Pages (free, no build minutes, unlimited
// bandwidth). Dynamic bits moved to Cloudflare Pages Functions (./functions).
const nextConfig: NextConfig = {
  output: "export",
  images: {
    // No image optimizer in a static export; photos are already web-sized
    // (Pexels "large", ~940px) so plain <img> is fine.
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
  },
  // Keep /guide/ URLs without trailing slashes; Cloudflare Pages resolves
  // /guide → /guide.html automatically.
  trailingSlash: false,
};

export default nextConfig;
