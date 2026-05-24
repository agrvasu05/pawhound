"use client";

import { useEffect, useRef } from "react";

type AdSlotProps = {
  type: "native" | "inpage-push";
  className?: string;
};

export default function AdSlot({ type, className = "" }: AdSlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  const zoneId =
    type === "native"
      ? process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_ID
      : process.env.NEXT_PUBLIC_ADSTERRA_INPAGE_PUSH_ID;

  useEffect(() => {
    if (!ref.current || !zoneId) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = `//pl${zoneId}.profitableratecpm.com/invoke.js`;
    ref.current.appendChild(script);
    return () => {
      if (ref.current) ref.current.innerHTML = "";
    };
  }, [zoneId]);

  return (
    <div ref={ref} className={`ad-slot ad-slot-${type} ${className}`} />
  );
}
