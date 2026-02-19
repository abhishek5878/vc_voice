"use client";

import { useCallback, useState } from "react";
import FounderChat from "@/components/FounderChat";
import type { StreamContext } from "@/lib/ingest/types";

export default function PitchIntake({
  voiceProfileText,
  headerSubtitle,
  slug,
  investorDisplayName,
}: {
  voiceProfileText: string | null;
  headerSubtitle?: string;
  /** When set, show "Submit this pitch to [investor]" in chat phase. */
  slug?: string;
  investorDisplayName?: string;
}) {
  const [phase, setPhase] = useState<"form" | "chat">("form");
  const [companyName, setCompanyName] = useState("");
  const [pitchText, setPitchText] = useState("");
  const [fetchUrlValue, setFetchUrlValue] = useState("");
  const [fetchUrlLoading, setFetchUrlLoading] = useState(false);
  const [uploadDeckLoading, setUploadDeckLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleFetchUrl = useCallback(async () => {
    const url = fetchUrlValue.trim();
    if (!url) {
      setError("Enter a URL to fetch.");
      return;
    }
    setError(null);
    setFetchUrlLoading(true);
    try {
      const res = await fetch("/api/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fetch failed");
      const text = (data.text as string) || "";
      setPitchText((prev) => (prev ? prev + "\n\n" + text : text));
      setFetchUrlValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setFetchUrlLoading(false);
    }
  }, [fetchUrlValue]);

  const handleUploadDeck = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadDeckLoading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/extract-pitch", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || "Upload failed");
      const text = (data.text as string) || "";
      setPitchText((prev) => (prev ? prev + "\n\n" + text : text));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadDeckLoading(false);
      e.target.value = "";
    }
  }, []);

  const pitchCharCount = (companyName.trim() ? `Company: ${companyName.trim()}\n\n` : "").length + pitchText.length;
  const hasPitchContent = pitchCharCount >= 50;

  const buildStreamContext = useCallback((): StreamContext => {
    const parts: string[] = [];
    if (companyName.trim()) {
      parts.push(`Company: ${companyName.trim()}`);
    }
    if (pitchText.trim()) {
      parts.push(pitchText.trim());
    }
    const pitchMaterial = parts.join("\n\n");
    return pitchMaterial ? { PITCH_MATERIAL: pitchMaterial } : {};
  }, [companyName, pitchText]);

  const handleStartStressTest = useCallback(() => {
    const ctx = buildStreamContext();
    if (!ctx.PITCH_MATERIAL?.trim()) {
      setError("Add your company name and/or pitch (paste text, upload a deck, or fetch from URL).");
      return;
    }
    setError(null);
    setPhase("chat");
  }, [buildStreamContext]);

  const handleSubmitPitch = useCallback(async () => {
    if (!slug || submitted || submitLoading) return;
    const ctx = buildStreamContext();
    const pitchMaterial = ctx.PITCH_MATERIAL?.trim();
    if (!pitchMaterial) return;
    setSubmitError(null);
    setSubmitLoading(true);
    try {
      const res = await fetch("/api/pitch/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          companyName: companyName.trim() || "Unknown",
          pitchText: pitchMaterial,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || "Submit failed");
      setSubmitted(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitLoading(false);
    }
  }, [slug, submitted, submitLoading, companyName, buildStreamContext]);

  if (phase === "chat") {
    const initialStreamContext = buildStreamContext();
    const showSubmit = Boolean(slug && investorDisplayName);
    const shareablePitchLink =
      typeof window !== "undefined" && slug ? `${window.location.origin}/pitch/${slug}` : null;
    return (
      <div className="space-y-4">
        <FounderChat
          initialStreamContext={initialStreamContext}
          voiceProfile={voiceProfileText}
          onBack={() => setPhase("form")}
          onToast={undefined}
          shareablePitchLink={shareablePitchLink}
        />
        {showSubmit && (
          <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
            {submitted ? (
              <p className="text-sm text-emerald-400/90">
                Pitch submitted. The investor will review it in their dashboard.
              </p>
            ) : (
              <>
                <p className="text-xs text-zinc-400 mb-3">
                  Ready to send this pitch to {investorDisplayName}? We’ll run the same analysis and add it to their queue.
                </p>
                <button
                  type="button"
                  onClick={handleSubmitPitch}
                  disabled={submitLoading}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-900 text-sm font-semibold disabled:opacity-50"
                >
                  {submitLoading ? "Submitting…" : `Submit this pitch to ${investorDisplayName}`}
                </button>
                {submitError && (
                  <p className="text-sm text-amber-400/90 mt-2">{submitError}</p>
                )}
              </>
            )}
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-4">
        <h2 className="text-sm font-medium text-zinc-300">Your pitch</h2>
        {headerSubtitle && (
          <p className="text-xs text-zinc-500">{headerSubtitle}</p>
        )}
        <div>
          <label htmlFor="pitch-company" className="block text-xs text-zinc-400 mb-1">
            Company name (optional)
          </label>
          <input
            id="pitch-company"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Inc."
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
        </div>
        <div>
          <label htmlFor="pitch-text" className="block text-xs text-zinc-400 mb-1">
            Pitch deck or narrative
          </label>
          <textarea
            id="pitch-text"
            value={pitchText}
            onChange={(e) => setPitchText(e.target.value)}
            placeholder="Paste your deck text, one-pager, or a short narrative of what you're building..."
            rows={6}
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-y"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">
            Or upload deck (PDF, PPT, or DOCX)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".pdf,.docx,.pptx"
              onChange={handleUploadDeck}
              className="hidden"
              id="pitch-deck-upload"
            />
            <label
              htmlFor="pitch-deck-upload"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-medium cursor-pointer disabled:opacity-50"
            >
              {uploadDeckLoading ? "Extracting…" : "Upload PDF / PPT / DOCX"}
            </label>
          </div>
        </div>
        <div>
          <label htmlFor="pitch-url" className="block text-xs text-zinc-400 mb-1">
            Or fetch from URL (Google Docs, Notion, etc.)
          </label>
          <div className="flex gap-2">
            <input
              id="pitch-url"
              type="url"
              value={fetchUrlValue}
              onChange={(e) => setFetchUrlValue(e.target.value)}
              placeholder="https://..."
              className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
            <button
              type="button"
              onClick={handleFetchUrl}
              disabled={fetchUrlLoading}
              className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-medium disabled:opacity-50"
            >
              {fetchUrlLoading ? "Fetching…" : "Fetch"}
            </button>
          </div>
        </div>
        {pitchCharCount > 0 && (
          <p className="text-xs text-zinc-500">
            {pitchCharCount.toLocaleString()} characters from your deck
            {!hasPitchContent && " — add more (or paste/upload/fetch) for a better stress-test."}
          </p>
        )}
        {error && (
          <p className="text-sm text-amber-400/90">{error}</p>
        )}
        <button
          type="button"
          onClick={handleStartStressTest}
          disabled={uploadDeckLoading || fetchUrlLoading}
          className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {uploadDeckLoading || fetchUrlLoading
            ? "Loading your deck…"
            : hasPitchContent
              ? `Start stress-test (${pitchCharCount.toLocaleString()} chars)`
              : "Start stress-test"}
        </button>
      </section>
    </div>
  );
}
