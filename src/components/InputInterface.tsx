"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import type { StreamContext } from "@/lib/ingest/types";
import { pdfFileToText } from "@/lib/pdfToImages";
import {
  loadSessionMetadata,
  saveSessionMetadata,
  loadLastRun,
  type SessionMetadata,
  type LastRunSnapshot,
} from "@/lib/sessionMetadata";

type Mode = 1 | 2 | 3;

function pasteFromClipboard(
  current: string,
  setter: (v: string) => void,
  append: boolean
): Promise<void> {
  return navigator.clipboard.readText().then((text) => {
    if (!text.trim()) return;
    setter(append && current ? current + "\n\n" + text : text);
  });
}

export default function InputInterface({
  mode,
  onBack,
  onRun,
  initialRun,
  initialClipboardFill,
  onClipboardFillApplied,
}: {
  mode: Mode;
  onBack: () => void;
  onRun: (
    streamContext: StreamContext,
    metadata: SessionMetadata
  ) => Promise<void>;
  initialRun?: LastRunSnapshot | null;
  initialClipboardFill?: { target: "PUBLIC_TRANSCRIPT" | "PITCH_MATERIAL"; text: string } | null;
  onClipboardFillApplied?: () => void;
}) {
  const [publicTranscript, setPublicTranscript] = useState("");
  const [privateDictation, setPrivateDictation] = useState("");
  const [pitchMaterial, setPitchMaterial] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [calendarEventUrl, setCalendarEventUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchUrlLoading, setFetchUrlLoading] = useState(false);
  const [fetchUrlTarget, setFetchUrlTarget] = useState<"PITCH_MATERIAL" | "PUBLIC_TRANSCRIPT">("PITCH_MATERIAL");
  const [fetchUrlValue, setFetchUrlValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fileStatus, setFileStatus] = useState<Record<string, string>>({});
  const [lastRunSnapshot, setLastRunSnapshot] = useState<LastRunSnapshot | null>(() =>
    typeof window !== "undefined" ? loadLastRun() : null
  );

  useEffect(() => {
    const meta = loadSessionMetadata();
    setMeetingTitle(meta.meetingTitle);
    setCompanyName(meta.companyName);
    setCalendarEventUrl(meta.calendarEventUrl);
    setLastRunSnapshot(loadLastRun());
  }, []);

  useEffect(() => {
    if (!initialRun) return;
    setPublicTranscript(initialRun.streamContext.PUBLIC_TRANSCRIPT ?? "");
    setPrivateDictation(initialRun.streamContext.PRIVATE_DICTATION ?? "");
    setPitchMaterial(initialRun.streamContext.PITCH_MATERIAL ?? "");
    setMeetingTitle(initialRun.metadata.meetingTitle ?? "");
    setCompanyName(initialRun.metadata.companyName ?? "");
    setCalendarEventUrl(initialRun.metadata.calendarEventUrl ?? "");
    saveSessionMetadata(initialRun.metadata);
  }, [initialRun]);

  const onClipboardFillAppliedRef = useRef(onClipboardFillApplied);
  onClipboardFillAppliedRef.current = onClipboardFillApplied;
  useEffect(() => {
    if (!initialClipboardFill) return;
    if (initialClipboardFill.target === "PUBLIC_TRANSCRIPT")
      setPublicTranscript((prev) => (prev ? prev + "\n\n" + initialClipboardFill!.text : initialClipboardFill!.text));
    else setPitchMaterial((prev) => (prev ? prev + "\n\n" + initialClipboardFill!.text : initialClipboardFill!.text));
    onClipboardFillAppliedRef.current?.();
  }, [initialClipboardFill]);

  const applyLastRun = useCallback(() => {
    const run = loadLastRun();
    if (!run) return;
    setPublicTranscript(run.streamContext.PUBLIC_TRANSCRIPT ?? "");
    setPrivateDictation(run.streamContext.PRIVATE_DICTATION ?? "");
    setPitchMaterial(run.streamContext.PITCH_MATERIAL ?? "");
    setMeetingTitle(run.metadata.meetingTitle ?? "");
    setCompanyName(run.metadata.companyName ?? "");
    setCalendarEventUrl(run.metadata.calendarEventUrl ?? "");
    saveSessionMetadata(run.metadata);
    setLastRunSnapshot(run);
  }, []);

  const persistMetadata = useCallback(() => {
    saveSessionMetadata({
      meetingTitle,
      companyName,
      calendarEventUrl,
    });
  }, [meetingTitle, companyName, calendarEventUrl]);

  const buildStreamContext = useCallback((): StreamContext => {
    const ctx: StreamContext = {};
    if (publicTranscript.trim()) ctx.PUBLIC_TRANSCRIPT = publicTranscript.trim();
    if (privateDictation.trim()) ctx.PRIVATE_DICTATION = privateDictation.trim();
    if (pitchMaterial.trim()) ctx.PITCH_MATERIAL = pitchMaterial.trim();
    return ctx;
  }, [publicTranscript, privateDictation, pitchMaterial]);

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
      if (fetchUrlTarget === "PITCH_MATERIAL")
        setPitchMaterial((prev) => (prev ? prev + "\n\n" + text : text));
      else setPublicTranscript((prev) => (prev ? prev + "\n\n" + text : text));
      setFetchUrlValue("");
      setFileStatus((s) => ({ ...s, [fetchUrlTarget]: "Loaded from URL" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setFetchUrlLoading(false);
    }
  }, [fetchUrlValue, fetchUrlTarget]);

  const handleFile = useCallback(
    async (stream: keyof StreamContext, file: File) => {
      const name = file.name.toLowerCase();
      if (name.endsWith(".txt") || name.endsWith(".md")) {
        const text = await file.text();
        if (stream === "PUBLIC_TRANSCRIPT")
          setPublicTranscript((prev) => (prev ? prev + "\n\n" + text : text));
        if (stream === "PRIVATE_DICTATION")
          setPrivateDictation((prev) => (prev ? prev + "\n\n" + text : text));
        if (stream === "PITCH_MATERIAL")
          setPitchMaterial((prev) => (prev ? prev + "\n\n" + text : text));
        setFileStatus((s) => ({ ...s, [stream]: `Loaded ${file.name}` }));
        return;
      }
      if (name.endsWith(".pdf")) {
        setFileStatus((s) => ({ ...s, [stream]: `Parsing ${file.name}…` }));
        try {
          const text = await pdfFileToText(file);
          if (!text || text.length < 10) {
            setFileStatus((s) => ({
              ...s,
              [stream]: "No text could be extracted (scanned PDF?). Paste text or use .txt / .docx.",
            }));
            return;
          }
          if (stream === "PUBLIC_TRANSCRIPT")
            setPublicTranscript((prev) => (prev ? prev + "\n\n" + text : text));
          if (stream === "PRIVATE_DICTATION")
            setPrivateDictation((prev) => (prev ? prev + "\n\n" + text : text));
          if (stream === "PITCH_MATERIAL")
            setPitchMaterial((prev) => (prev ? prev + "\n\n" + text : text));
          setFileStatus((s) => ({ ...s, [stream]: `Parsed ${file.name}` }));
        } catch (e) {
          setFileStatus((s) => ({
            ...s,
            [stream]: `Error: ${e instanceof Error ? e.message : "PDF parse failed"}`,
          }));
        }
        return;
      }
      if (name.endsWith(".docx")) {
        setFileStatus((s) => ({ ...s, [stream]: `Parsing ${file.name}…` }));
        try {
          const m = await import("mammoth");
          const mammoth = "default" in m && m.default ? m.default : m;
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          const text = (result?.value ?? "").trim();
          if (stream === "PUBLIC_TRANSCRIPT")
            setPublicTranscript((prev) => (prev ? prev + "\n\n" + text : text));
          if (stream === "PRIVATE_DICTATION")
            setPrivateDictation((prev) => (prev ? prev + "\n\n" + text : text));
          if (stream === "PITCH_MATERIAL")
            setPitchMaterial((prev) => (prev ? prev + "\n\n" + text : text));
          setFileStatus((s) => ({ ...s, [stream]: `Parsed ${file.name}` }));
        } catch (e) {
          setFileStatus((s) => ({
            ...s,
            [stream]: `Error: ${e instanceof Error ? e.message : "DOCX parse failed"}`,
          }));
        }
        return;
      }
      setFileStatus((s) => ({
        ...s,
        [stream]: "Unsupported format. Use .txt, .md, .pdf, .docx",
      }));
    },
    []
  );

  const runAnalysis = useCallback(async () => {
    const ctx = buildStreamContext();
    const total =
      (ctx.PUBLIC_TRANSCRIPT?.length ?? 0) +
      (ctx.PRIVATE_DICTATION?.length ?? 0) +
      (ctx.PITCH_MATERIAL?.length ?? 0);
    if (total < 200) {
      setError(`Add ${200 - total} more characters (minimum 200 total).`);
      return;
    }
    setError(null);
    setLoading(true);
    const metadata: SessionMetadata = {
      meetingTitle,
      companyName,
      calendarEventUrl,
    };
    persistMetadata();
    try {
      await onRun(ctx, metadata);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [buildStreamContext, onRun, meetingTitle, companyName, calendarEventUrl, persistMetadata]);

  const totalChars =
    publicTranscript.length + privateDictation.length + pitchMaterial.length;
  const hasInput = totalChars > 0;
  const canRun = hasInput && totalChars >= 200;

  const rowActions = (
    stream: "PUBLIC_TRANSCRIPT" | "PRIVATE_DICTATION" | "PITCH_MATERIAL",
    value: string,
    setValue: (v: string) => void
  ) => (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      <span className="text-xs text-zinc-500">{value.length} chars</span>
      <button
        type="button"
        onClick={() =>
          pasteFromClipboard(value, setValue, value.length > 0).catch(() =>
            setError("Clipboard access denied or empty.")
          )
        }
        className="text-xs text-amber-500/90 hover:text-amber-400"
      >
        Paste from clipboard
      </button>
      <input
        type="file"
        accept=".txt,.md,.pdf,.docx"
        className="text-xs text-zinc-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-zinc-800 file:text-zinc-300"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setFileStatus((s) => ({ ...s, [stream]: "" }));
            handleFile(stream, f);
          }
          e.target.value = "";
        }}
      />
      {fileStatus[stream] && (
        <span className="text-xs text-amber-500/80">{fileStatus[stream]}</span>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="sticky top-0 z-10 p-4 sm:p-6 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-xl font-semibold tracking-tight">Robin.ai</h1>
        </div>
        <span className="text-xs text-zinc-500 uppercase tracking-wider">
          {mode === 1 ? "Post-Meeting" : mode === 2 ? "Pre-Meeting Prep" : "Pitch Stress-Test"}
        </span>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 sm:p-8 max-w-6xl mx-auto w-full">
        {mode === 1 && (
          <p className="lg:col-span-2 text-sm text-zinc-500 max-w-2xl">
            Paste meeting transcript and optional private notes. Robin will extract claims, find conflicts, run GRUE, and build the interrogation.
          </p>
        )}
        {mode === 2 && (
          <p className="lg:col-span-2 text-sm text-zinc-500 max-w-2xl">
            Paste or upload pitch deck / memo. You&apos;ll get the attack brief: red list, yellow list, and recommended question order.
          </p>
        )}
        {mode === 3 && (
          <>
            <div className="lg:col-span-2 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <p className="text-sm font-medium text-zinc-200 mb-1">For founders: stress-test your pitch</p>
              <p className="text-sm text-zinc-500 max-w-2xl">
                Paste your deck or one-liner. You&apos;ll get a blunt, skeptical VC—short answers, real numbers, no fluff. Then chat to harden the pitch before the real meeting.
              </p>
            </div>
            <div className="lg:col-span-2">
              <button
                type="button"
                onClick={() => {
                  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/app?mode=3`;
                  void navigator.clipboard.writeText(url).then(() => setError(null));
                }}
                className="text-sm text-amber-500/90 hover:text-amber-400"
              >
                Send link to founder (copy stress-test URL)
              </button>
            </div>
          </>
        )}

        {lastRunSnapshot && (
          <div className="lg:col-span-2">
            <button
              type="button"
              onClick={applyLastRun}
              className="text-sm text-amber-500/90 hover:text-amber-400"
            >
              Duplicate last run →
            </button>
          </div>
        )}

        <div className="space-y-6">
          <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
            <h2 className="text-sm font-medium text-zinc-400 mb-3">Public Transcript</h2>
            <textarea
              value={publicTranscript}
              onChange={(e) => {
                setPublicTranscript(e.target.value);
                setError(null);
              }}
              placeholder={mode === 1 ? "Paste meeting transcript or .txt/.md" : mode === 2 ? "Optional: any shared context" : "Paste transcript or pitch narrative"}
              className="w-full h-32 px-4 py-3 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 focus:outline-none resize-y transition-colors"
            />
            {rowActions("PUBLIC_TRANSCRIPT", publicTranscript, setPublicTranscript)}
          </section>

          <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
            <h2 className="text-sm font-medium text-zinc-400 mb-3">Private Dictation</h2>
            <textarea
              value={privateDictation}
              onChange={(e) => {
                setPrivateDictation(e.target.value);
                setError(null);
              }}
              placeholder={mode === 1 ? "Paste private notes or voice note" : "Optional: private notes or .txt/.md/.pdf/.docx"}
              className="w-full h-32 px-4 py-3 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 focus:outline-none resize-y transition-colors"
            />
            {rowActions("PRIVATE_DICTATION", privateDictation, setPrivateDictation)}
          </section>

          <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
            <h2 className="text-sm font-medium text-zinc-400 mb-3">Pitch Material</h2>
            <textarea
              value={pitchMaterial}
              onChange={(e) => {
                setPitchMaterial(e.target.value);
                setError(null);
              }}
              placeholder={mode === 2 ? "Paste pitch deck / memo or upload PDF/DOCX (required)" : "Paste deck narrative or upload PDF/DOCX"}
              className="w-full h-32 px-4 py-3 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 focus:outline-none resize-y transition-colors"
            />
            {rowActions("PITCH_MATERIAL", pitchMaterial, setPitchMaterial)}
            <div className="mt-3 pt-3 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 mb-2">Or fetch from URL (Google Docs, Notion, Medium, etc.)</p>
              <div className="flex flex-wrap gap-2">
                <select
                  value={fetchUrlTarget}
                  onChange={(e) => setFetchUrlTarget(e.target.value as "PITCH_MATERIAL" | "PUBLIC_TRANSCRIPT")}
                  className="px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs"
                >
                  <option value="PITCH_MATERIAL">→ Pitch Material</option>
                  <option value="PUBLIC_TRANSCRIPT">→ Public Transcript</option>
                </select>
                <input
                  type="url"
                  value={fetchUrlValue}
                  onChange={(e) => setFetchUrlValue(e.target.value)}
                  placeholder="https://…"
                  className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm placeholder-zinc-500"
                />
                <button
                  type="button"
                  onClick={handleFetchUrl}
                  disabled={fetchUrlLoading}
                  className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm disabled:opacity-50"
                >
                  {fetchUrlLoading ? "Fetching…" : "Fetch"}
                </button>
              </div>
            </div>
          </section>

          {hasInput && totalChars > 0 && (
            <p className="text-xs text-zinc-500 px-1">
              This run will use:{" "}
              {[
                publicTranscript.trim() && `Transcript ${publicTranscript.trim().length.toLocaleString()} chars`,
                privateDictation.trim() && `Notes ${privateDictation.trim().length.toLocaleString()} chars`,
                pitchMaterial.trim() && `Pitch ${pitchMaterial.trim().length.toLocaleString()} chars`,
              ]
                .filter(Boolean)
                .join(" · ")}
              {meetingTitle.trim() && ` · Meeting: ${meetingTitle.trim().slice(0, 40)}${meetingTitle.trim().length > 40 ? "…" : ""}`}
            </p>
          )}

          {error && (
            <p className="text-sm text-red-400/90 px-1">{error}</p>
          )}

          <button
            type="button"
            onClick={runAnalysis}
            disabled={loading || !canRun}
            className="btn-primary w-full py-3.5 text-base"
          >
            {loading ? "Running… (usually 30–60 sec)" : "Run Robin"}
          </button>
          <p className="text-xs text-zinc-500 px-1 mt-1">
            Sign in and enter a company name to save this run to Deal Memory.
          </p>
        </div>

        <div className="space-y-6">
          <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Session context</h3>
            <label className="block text-xs text-zinc-500 mb-1">Meeting title (optional)</label>
            <input
              type="text"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              onBlur={persistMetadata}
              placeholder="e.g. Partner call – Acme Co"
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm placeholder-zinc-500 focus:border-amber-500/40 focus:outline-none mb-3"
            />
            <label className="block text-xs text-zinc-500 mb-1">Company / founder (optional)</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onBlur={persistMetadata}
              placeholder="e.g. Acme Inc"
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm placeholder-zinc-500 focus:border-amber-500/40 focus:outline-none mb-3"
            />
            <label className="block text-xs text-zinc-500 mb-1">Calendar event link (optional)</label>
            <input
              type="url"
              value={calendarEventUrl}
              onChange={(e) => setCalendarEventUrl(e.target.value)}
              onBlur={persistMetadata}
              placeholder="https://calendar.google.com/… or Calendly link"
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm placeholder-zinc-500 focus:border-amber-500/40 focus:outline-none"
            />
            <p className="text-xs text-zinc-500 mt-2">
              Total input: <strong className="text-zinc-300">{totalChars}</strong> chars
              {totalChars > 0 && totalChars < 200 && (
                <span className="text-amber-500/90 ml-1"> — add {200 - totalChars} more (min 200)</span>
              )}
            </p>
            <p className="text-xs text-zinc-600 mt-1">We remember meeting title and company for next time.</p>
          </section>

          {/* AI configuration now uses server-side OPENAI_API_KEY; no BYOK controls needed in UI. */}
        </div>
      </main>
    </div>
  );
}
