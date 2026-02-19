"use client";

import { useState, useCallback } from "react";

export default function CopyablePitchLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/pitch/${slug}`
      : `https://www.pitchrobin.work/pitch/${slug}`;
  const displayUrl = `pitchrobin.work/pitch/${slug}`;

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [url]);

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/80 border border-zinc-700 text-xs font-medium text-zinc-300 hover:bg-zinc-700/80 hover:text-zinc-100 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
      title="Copy link"
    >
      <span>{displayUrl}</span>
      <span className="text-cyan-400/90">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
