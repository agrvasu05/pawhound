"use client";

import { useState } from "react";

export default function SubscribeForm({ source = "freebie" }: { source?: string }) {
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
