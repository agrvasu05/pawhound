"use client";

import { useState, useEffect, useId } from "react";

type AdSlotProps = {
  type: "native" | "inpage-push";
  className?: string;
};

export default function AdSlot({ type, className = "" }: AdSlotProps) {
  const [visible, setVisible] = useState(false);
  const uid = useId().replace(/:/g, "");

  const zoneId =
    type === "native"
      ? process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_ID
      : process.env.NEXT_PUBLIC_ADSTERRA_INPAGE_PUSH_ID;

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.adSlotId === uid && e.data?.filled) {
        setVisible(true);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [uid]);

  if (!zoneId) return null;

  // Each iframe runs in its own JS context — fixes atOptions global conflict
  // when multiple Adsterra ads are on the same page.
  // After 2.5s the iframe checks if Adsterra injected content and tells the
  // parent via postMessage — parent only shows the slot if an ad loaded,
  // preventing empty 250px gaps when there is no fill.
  const html = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: transparent; overflow: hidden; }
</style>
</head>
<body>
<script async="async" data-cfasync="false" src="https://pl${zoneId}.profitableratecpm.com/invoke.js"></script>
<script>
  setTimeout(function () {
    var filled =
      document.body.innerText.trim().length > 10 ||
      document.body.querySelectorAll('img,iframe,ins,div[id]').length > 0;
    window.parent.postMessage({ adSlotId: '${uid}', filled: filled }, '*');
  }, 2500);
</script>
</body>
</html>`;

  return (
    <div
      className={`ad-slot ad-slot-${type} ${className}`}
      style={{ display: visible ? "block" : "none" }}
    >
      <iframe
        srcDoc={html}
        style={{
          width: "100%",
          minHeight: "250px",
          border: "none",
          overflow: "hidden",
          display: "block",
        }}
        scrolling="no"
        title={`ad-${type}-${uid}`}
      />
    </div>
  );
}
