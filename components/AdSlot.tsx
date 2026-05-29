"use client";

import { useEffect, useRef } from "react";

type AdSlotProps = {
  /** Kept for backward-compatible call sites; AdSense uses one responsive unit. */
  type?: "native" | "inpage-push";
  className?: string;
};

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Google AdSense responsive display unit. Renders nothing until both the
 * publisher client and an ad-unit slot ID are configured via env, so the site
 * is safe to ship before AdSense approval. Ads also won't fill on localhost or
 * an unapproved domain — that's expected.
 */
export default function AdSlot({ className = "" }: AdSlotProps) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT;
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!client || !slot) return;
    const ins = insRef.current;
    // Guard against React Strict Mode double-invoke / hot reloads pushing twice.
    if (!ins || ins.getAttribute("data-adsbygoogle-status")) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* loader not ready yet — it will pick this slot up on next pass */
    }
  }, [client, slot]);

  if (!client || !slot) return null;

  return (
    <div className={`ad-slot ${className}`}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block", textAlign: "center" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
