"use client";

type AdSlotProps = {
  type: "native" | "inpage-push";
  className?: string;
};

export default function AdSlot({ type, className = "" }: AdSlotProps) {
  const zoneId =
    type === "native"
      ? process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_ID
      : process.env.NEXT_PUBLIC_ADSTERRA_INPAGE_PUSH_ID;

  if (!zoneId) return null;

  // Each iframe has its own JS context — fixes atOptions global variable
  // conflict when multiple Adsterra ads load on the same page
  const html = `<!DOCTYPE html><html><head><style>*{margin:0;padding:0;}body{overflow:hidden;background:transparent;}</style></head><body><script async="async" data-cfasync="false" src="//pl${zoneId}.profitableratecpm.com/invoke.js"></script></body></html>`;

  return (
    <div className={`ad-slot ad-slot-${type} ${className}`}>
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
        title={`ad-${type}-${zoneId}`}
      />
    </div>
  );
}
