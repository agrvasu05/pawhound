// Serves /ads.txt for Google AdSense. Auto-fills the publisher ID, so there is
// nothing to hand-edit. Prerendered at build time.
import { ADSENSE_CLIENT } from "@/lib/ads";

export const dynamic = "force-static";

export function GET() {
  const body = ADSENSE_CLIENT
    ? `google.com, ${ADSENSE_CLIENT.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`
    : "";
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
