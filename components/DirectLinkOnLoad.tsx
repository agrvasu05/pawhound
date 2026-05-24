"use client";

import { useEffect } from "react";

export default function DirectLinkOnLoad({ href }: { href: string }) {
  useEffect(() => {
    if (href) window.open(href, "_blank");
  }, []);

  return null;
}
