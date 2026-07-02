"use client";

import { useState } from "react";
import Image from "next/image";

/** One-time offer shown right after opt-in (the $4–6 tripwire). */
export type TripwireOffer = {
  title: string;
  price: number;
  url: string;
  image: string | null;
};

export default function SubscribeForm({
  source = "freebie",
  offer = null,
}: {
  source?: string;
  offer?: TripwireOffer | null;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [download, setDownload] = useState("");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setErr("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error || "Something went wrong — please try again.");
        setState("error");
        return;
      }
      setDownload(data.download);
      setState("done");
    } catch {
      setErr("Network error — please try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-6 text-center">
          <p className="mb-3 text-lg font-semibold text-stone-800">🎉 You&apos;re in! Check your inbox.</p>
          <p className="mb-4 text-sm text-stone-500">Didn&apos;t arrive yet? Grab it right now:</p>
          <a
            href={download}
            target="_blank"
            rel="noopener"
            className="inline-block rounded-full bg-[#b05a3c] px-7 py-3 font-semibold text-white no-underline hover:bg-[#9c4f34]"
          >
            Download the Cozy Home Reset →
          </a>
        </div>

        {offer && (
          <div className="rounded-xl border-2 border-[#2d4a3e] bg-white p-6">
            <p className="mb-1 text-center text-xs font-semibold uppercase tracking-widest text-[#2d4a3e]">
              New-subscriber pick · just ${offer.price}
            </p>
            <p className="mb-4 text-center text-sm text-stone-500">
              While your reset prints, the printable our readers pair with it most:
            </p>
            <div className="flex items-center gap-4">
              {offer.image && (
                <Image
                  src={offer.image}
                  alt={offer.title}
                  width={96}
                  height={128}
                  className="h-32 w-24 flex-shrink-0 rounded-lg object-cover ring-1 ring-stone-200"
                />
              )}
              <div className="min-w-0">
                <p className="mb-3 font-semibold leading-snug text-stone-800">{offer.title}</p>
                <a
                  href={offer.url}
                  target="_blank"
                  rel="noopener"
                  className="inline-block rounded-full bg-[#2d4a3e] px-6 py-2.5 text-sm font-semibold text-white no-underline hover:bg-[#243c32]"
                >
                  Get it for ${offer.price} →
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        aria-label="Email address"
        className="flex-1 rounded-full border border-stone-300 px-5 py-3 text-stone-800 outline-none focus:border-[#b05a3c]"
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className="rounded-full bg-[#b05a3c] px-7 py-3 font-semibold text-white hover:bg-[#9c4f34] disabled:opacity-60"
      >
        {state === "loading" ? "Sending…" : "Send me the free printable"}
      </button>
      {err && <p className="text-sm text-red-600 sm:basis-full">{err}</p>}
    </form>
  );
}
