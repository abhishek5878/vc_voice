"use client";

import { useCallback, useState } from "react";
import type { StreamContext } from "@/lib/ingest/types";
import { pdfFileToText } from "@/lib/pdfToImages";

type Mode = 1 | 2 | 3;

const STORAGE_KEY = "robin_api_key";
const STORAGE_PROVIDER = "robin_provider";

export default function InputInterface({
  mode,
  onBack,
  onRun,
}: {
  mode: Mode;
  onBack: () => void;
  onRun: (
    streamContext: StreamContext,
    apiKey: string,
    provider: "openai" | "anthropic" | "groq"
  ) => Promise<void>;
}) {
  const [publicTranscript, setPublicTranscript] = useState("");
  const [privateDictation, setPrivateDictation] = useState("");
  const [pitchMaterial, setPitchMaterial] = useState("");
  const [apiKey, setApiKey] = useState(() =>
    typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) ?? "" : ""
  );
  const [provider, setProvider] = useState<"openai" | "anthropic" | "groq">(() => {
    if (typeof window !== "undefined") {
      const p = sessionStorage.getItem(STORAGE_PROVIDER);
      if (p === "anthropic" || p === "groq") return p;
    }
    return "openai";
  });
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileStatus, setFileStatus] = useState<Record<string, string>>({});

  const saveKey = useCallback((key: string) => {
    setApiKey(key);
    if (typeof window !== "undefined") {
      if (key) sessionStorage.setItem(STORAGE_KEY, key);
      else sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const saveProvider = useCallback((p: "openai" | "anthropic" | "groq") => {
    setProvider(p);
    if (typeof window !== "undefined") sessionStorage.setItem(STORAGE_PROVIDER, p);
  }, []);

  const buildStreamContext = useCallback((): StreamContext => {
    const ctx: StreamContext = {};
    if (publicTranscript.trim()) ctx.PUBLIC_TRANSCRIPT = publicTranscript.trim();
    if (privateDictation.trim()) ctx.PRIVATE_DICTATION = privateDictation.trim();
    if (pitchMaterial.trim()) ctx.PITCH_MATERIAL = pitchMaterial.trim();
    return ctx;
  }, [publicTranscript, privateDictation, pitchMaterial]);

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
      setError("Input too short. Paste at least 200 characters total.");
      return;
    }
    if (!apiKey.trim()) {
      setError("Enter your API key (Settings).");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onRun(ctx, apiKey.trim(), provider);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, [buildStreamContext, apiKey, provider, onRun]);

  const totalChars =
    publicTranscript.length + privateDictation.length + pitchMaterial.length;
  const hasInput = totalChars > 0;
  const canRun = hasInput && apiKey.trim().length > 0 && totalChars >= 200;

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
          <p className="lg:col-span-2 text-sm text-zinc-500 max-w-2xl">
            Paste pitch material to run the pipeline. Same evidence map and interrogation—use this to stress-test before the meeting.
          </p>
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
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-zinc-500">{publicTranscript.length} chars</span>
              <input
                type="file"
                accept=".txt,.md,.pdf,.docx"
                className="text-xs text-zinc-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-zinc-800 file:text-zinc-300"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFileStatus((s) => ({ ...s, PUBLIC_TRANSCRIPT: "" }));
                    handleFile("PUBLIC_TRANSCRIPT", f);
                  }
                  e.target.value = "";
                }}
              />
              {fileStatus.PUBLIC_TRANSCRIPT && (
                <span className="text-xs text-amber-500/80">{fileStatus.PUBLIC_TRANSCRIPT}</span>
              )}
            </div>
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
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-zinc-500">{privateDictation.length} chars</span>
              <input
                type="file"
                accept=".txt,.md,.pdf,.docx"
                className="text-xs text-zinc-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-zinc-800 file:text-zinc-300"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFileStatus((s) => ({ ...s, PRIVATE_DICTATION: "" }));
                    handleFile("PRIVATE_DICTATION", f);
                  }
                  e.target.value = "";
                }}
              />
              {fileStatus.PRIVATE_DICTATION && (
                <span className="text-xs text-amber-500/80">{fileStatus.PRIVATE_DICTATION}</span>
              )}
            </div>
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
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-zinc-500">{pitchMaterial.length} chars</span>
              <input
                type="file"
                accept=".txt,.md,.pdf,.docx"
                className="text-xs text-zinc-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-zinc-800 file:text-zinc-300"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFileStatus((s) => ({ ...s, PITCH_MATERIAL: "" }));
                    handleFile("PITCH_MATERIAL", f);
                  }
                  e.target.value = "";
                }}
              />
              {fileStatus.PITCH_MATERIAL && (
                <span className="text-xs text-amber-500/80">{fileStatus.PITCH_MATERIAL}</span>
              )}
            </div>
          </section>

          {error && (
            <p className="text-sm text-red-400/90 px-1">{error}</p>
          )}

          <button
            type="button"
            onClick={runAnalysis}
            disabled={loading || !canRun}
            className="btn-primary w-full py-3.5 text-base"
          >
            {loading ? "Running…" : "Run Robin"}
          </button>
        </div>

        <div className="space-y-6">
          <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Session context</h3>
            <p className="text-xs text-zinc-500">
              Founder/company and pedigree will appear here once connected to Supabase.
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              Total input: <strong className="text-zinc-300">{totalChars}</strong> chars
              {totalChars > 0 && totalChars < 200 && (
                <span className="text-amber-500/90 ml-1"> (min 200)</span>
              )}
            </p>
          </section>

          <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">AI configuration (BYOK)</h3>
            <label className="block text-xs text-zinc-500 mb-1">Provider</label>
            <select
              value={provider}
              onChange={(e) =>
                saveProvider(e.target.value as "openai" | "anthropic" | "groq")
              }
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm mb-3 focus:border-amber-500/40 focus:outline-none"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="groq">Groq</option>
            </select>
            <label className="block text-xs text-zinc-500 mb-1">API key (session only)</label>
            <div className="flex gap-2">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => saveKey(e.target.value)}
                placeholder="sk-… or key"
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder-zinc-500 text-sm focus:border-amber-500/40 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="text-xs text-zinc-500 hover:text-zinc-300 px-2"
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
