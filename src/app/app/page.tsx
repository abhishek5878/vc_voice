"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import ModeSelect from "@/components/ModeSelect";
import InputInterface from "@/components/InputInterface";
import PipelineProgress from "@/components/PipelineProgress";
import AnalysisReport from "@/components/AnalysisReport";
import FounderChat from "@/components/FounderChat";
import Toast from "@/components/Toast";
import CommandPalette from "@/components/CommandPalette";
import type { PipelineResult } from "@/lib/pipeline/types";
import type { StreamContext } from "@/lib/ingest/types";
import type { SessionMetadata } from "@/lib/sessionMetadata";
import { saveLastRun, loadLastRun, pushRecentRun } from "@/lib/sessionMetadata";
import { readClipboardOffer, type ClipboardOffer } from "@/lib/clipboardDetect";
import { getRedListPreview } from "@/lib/reportMarkdown";
import { getSupabaseAccessToken } from "@/lib/deals/supabase-auth";

type View = "mode" | "input" | "progress" | "report" | "chat";

interface ChatSession {
  streamContext: StreamContext;
}

export type ClipboardFillTarget = "PUBLIC_TRANSCRIPT" | "PITCH_MATERIAL";

export default function AppPage() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>("mode");
  const [mode, setMode] = useState<1 | 2 | 3>(1);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [progressStep, setProgressStep] = useState(0);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [reportMetadata, setReportMetadata] = useState<SessionMetadata | null>(null);
  const [initialRunForInput, setInitialRunForInput] = useState<Awaited<ReturnType<typeof loadLastRun>> | null>(null);
  const [clipboardOffer, setClipboardOffer] = useState<ClipboardOffer | null>(null);
  const [initialClipboardFill, setInitialClipboardFill] = useState<{ target: ClipboardFillTarget; text: string } | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastDealId, setLastDealId] = useState<string | null>(null);
  const clipboardChecked = useRef(false);
  const urlRunFetched = useRef(false);

  useEffect(() => {
    const m = searchParams.get("mode");
    const prep = searchParams.get("prep");
    if (m === "1" || m === "2" || m === "3") {
      setMode(Number(m) as 1 | 2 | 3);
      setView("input");
    }
    if (prep === "1") {
      setMode(2);
      setView("input");
    }
  }, [searchParams]);

  useEffect(() => {
    const run = searchParams.get("run");
    const url = searchParams.get("url");
    if (run !== "1" || !url?.trim() || urlRunFetched.current) return;
    urlRunFetched.current = true;
    setMode(2);
    setView("input");
    fetch("/api/fetch-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setToastMessage(data.error);
          setTimeout(() => setToastMessage(null), 4000);
          return;
        }
        if (data.text) setInitialClipboardFill({ target: "PITCH_MATERIAL", text: data.text });
      })
      .catch(() => {
        setToastMessage("Could not fetch URL.");
        setTimeout(() => setToastMessage(null), 4000);
      });
  }, [searchParams]);

  useEffect(() => {
    if (view !== "mode" && view !== "input" || clipboardOffer) return;
    const t = setTimeout(async () => {
      if (clipboardChecked.current) return;
      clipboardChecked.current = true;
      const offer = await readClipboardOffer();
      if (offer) setClipboardOffer(offer);
    }, 600);
    return () => clearTimeout(t);
  }, [view, clipboardOffer]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleStartMode = useCallback((m: 1 | 2 | 3) => {
    setMode(m);
    setInitialRunForInput(null);
    setView("input");
  }, []);

  const handleBackToMode = useCallback(() => {
    setView("mode");
    setResult(null);
    setChatSession(null);
    setReportMetadata(null);
    setInitialRunForInput(null);
  }, []);

  const handleRun = useCallback(
    async (
      streamContext: StreamContext,
      _apiKey: string,
      _provider: "openai" | "anthropic" | "groq",
      metadata: SessionMetadata
    ) => {
      if (mode === 3) {
        setChatSession({ streamContext });
        setView("chat");
        saveLastRun({ mode: 3, streamContext, metadata, timestamp: Date.now(), provider: "openai" });
        return;
      }

      setView("progress");
      setProgressStep(0);
      const interval = setInterval(() => {
        setProgressStep((s) => Math.min(3, s + 1));
      }, 1200);
      try {
        const supabaseToken = await getSupabaseAccessToken();
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            streamContext,
            mode,
            provider: "openai",
            companyName: metadata.companyName || undefined,
            supabaseAccessToken: supabaseToken || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || data.error || "Analysis failed");
        const pipelineResult = data as PipelineResult & { dealId?: string };
        setResult(pipelineResult);
        setLastDealId(pipelineResult.dealId ?? null);
        setReportMetadata(metadata);
        setView("report");
        saveLastRun({ mode, streamContext, metadata, timestamp: Date.now(), provider: "openai" });
        pushRecentRun({
          mode,
          meetingTitle: metadata.meetingTitle ?? "",
          companyName: metadata.companyName ?? "",
          timestamp: Date.now(),
          redListPreview: getRedListPreview(pipelineResult),
        });
      } catch (e) {
        setView("input");
        throw e;
      } finally {
        clearInterval(interval);
      }
    },
    [mode]
  );

  const handleBackToInput = useCallback(() => {
    setResult(null);
    setInitialRunForInput(loadLastRun());
    setView("input");
  }, []);

  const handleSelectRecentRun = useCallback((run: { redListPreview: string[] }) => {
    const text = run.redListPreview.join("\n");
    if (text) {
      void navigator.clipboard.writeText(text);
      setToastMessage("Red list copied to clipboard");
      setTimeout(() => setToastMessage(null), 2500);
    }
  }, []);

  return (
    <>
      {view === "mode" && <ModeSelect onStart={handleStartMode} />}

      {view === "input" && (
        <>
          <InputInterface
            mode={mode}
            onBack={handleBackToMode}
            onRun={handleRun}
            initialRun={initialRunForInput ?? undefined}
            initialClipboardFill={initialClipboardFill}
            onClipboardFillApplied={() => setInitialClipboardFill(null)}
          />
          {clipboardOffer?.type === "link" && (
            <Toast
              message="Found a link in clipboard. Autofill into Pitch Material?"
              actionLabel="Yes"
              onAction={() => {
                setInitialClipboardFill({ target: "PITCH_MATERIAL", text: clipboardOffer.text });
                setClipboardOffer(null);
                setView("input");
              }}
              onDismiss={() => setClipboardOffer(null)}
            />
          )}
          {clipboardOffer?.type === "transcript" && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 shadow-xl text-sm">
              <span className="text-zinc-300">Found a transcript. Autofill into:</span>
              <button
                type="button"
                onClick={() => {
                  setInitialClipboardFill({ target: "PUBLIC_TRANSCRIPT", text: clipboardOffer.text });
                  setClipboardOffer(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-600 text-zinc-950 font-medium"
              >
                Transcript
              </button>
              <button
                type="button"
                onClick={() => {
                  setInitialClipboardFill({ target: "PITCH_MATERIAL", text: clipboardOffer.text });
                  setClipboardOffer(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-zinc-700 text-zinc-200"
              >
                Pitch
              </button>
              <button type="button" onClick={() => setClipboardOffer(null)} className="px-2 text-zinc-400 hover:text-zinc-200">
                ×
              </button>
            </div>
          )}
        </>
      )}

      {view === "progress" && <PipelineProgress current={progressStep} />}

      {view === "report" && result && (
        <AnalysisReport
          result={result}
          metadata={reportMetadata}
          onBack={handleBackToInput}
          onDuplicateRun={handleBackToInput}
          dealId={lastDealId}
          onDealSaved={(id) => {
            setLastDealId(id);
            setToastMessage("Deal saved to your history.");
            setTimeout(() => setToastMessage(null), 3000);
          }}
        />
      )}

      {view === "chat" && chatSession && (
        <FounderChat
          initialStreamContext={chatSession.streamContext}
          onBack={() => {
            setView("input");
            setChatSession(null);
          }}
          onToast={(msg) => {
            setToastMessage(msg);
            setTimeout(() => setToastMessage(null), 2500);
          }}
        />
      )}

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectMode={(m) => {
          setMode(m);
          setInitialRunForInput(null);
          setView("input");
        }}
        onSelectRecentRun={handleSelectRecentRun}
      />

      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} dismissAfterMs={2500} />
      )}
    </>
  );
}

