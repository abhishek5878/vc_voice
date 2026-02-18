"use client";

import { useCallback, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ModeSelect from "@/components/ModeSelect";
import InputInterface from "@/components/InputInterface";
import PipelineProgress from "@/components/PipelineProgress";
import AnalysisReport from "@/components/AnalysisReport";
import FounderChat from "@/components/FounderChat";
import type { PipelineResult } from "@/lib/pipeline/types";
import type { StreamContext } from "@/lib/ingest/types";
import type { SessionMetadata } from "@/lib/sessionMetadata";
import { saveLastRun, loadLastRun } from "@/lib/sessionMetadata";

type View = "mode" | "input" | "progress" | "report" | "chat";

interface ChatSession {
  streamContext: StreamContext;
  apiKey: string;
  provider: "openai" | "anthropic" | "groq";
}

export default function AppPage() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>("mode");
  const [mode, setMode] = useState<1 | 2 | 3>(1);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [progressStep, setProgressStep] = useState(0);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [reportMetadata, setReportMetadata] = useState<SessionMetadata | null>(null);
  const [initialRunForInput, setInitialRunForInput] = useState<Awaited<ReturnType<typeof loadLastRun>> | null>(null);

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
      apiKey: string,
      provider: "openai" | "anthropic" | "groq",
      metadata: SessionMetadata
    ) => {
      if (mode === 3) {
        setChatSession({ streamContext, apiKey, provider });
        setView("chat");
        saveLastRun({ mode: 3, streamContext, metadata, timestamp: Date.now() });
        return;
      }

      setView("progress");
      setProgressStep(0);
      const interval = setInterval(() => {
        setProgressStep((s) => Math.min(3, s + 1));
      }, 1200);
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ streamContext, mode, provider }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || data.error || "Analysis failed");
        setResult(data as PipelineResult);
        setReportMetadata(metadata);
        setView("report");
        saveLastRun({ mode, streamContext, metadata, timestamp: Date.now() });
      } catch (e) {
        setView("input");
        throw e;
      } finally {
        clearInterval(interval);
      }
    },
    [mode]
  );

  const handleBackToInput = useCallback((duplicateRun: boolean) => {
    setResult(null);
    setInitialRunForInput(duplicateRun ? loadLastRun() : null);
    setView("input");
  }, []);

  if (view === "mode") {
    return <ModeSelect onStart={handleStartMode} />;
  }

  if (view === "input") {
    return (
      <InputInterface
        mode={mode}
        onBack={handleBackToMode}
        onRun={handleRun}
        initialRun={initialRunForInput ?? undefined}
      />
    );
  }

  if (view === "progress") {
    return <PipelineProgress current={progressStep} />;
  }

  if (view === "report" && result) {
    return (
      <AnalysisReport
        result={result}
        metadata={reportMetadata}
        onBack={() => handleBackToInput(false)}
        onDuplicateRun={() => handleBackToInput(true)}
      />
    );
  }

  if (view === "chat" && chatSession) {
    return (
      <FounderChat
        initialStreamContext={chatSession.streamContext}
        apiKey={chatSession.apiKey}
        provider={chatSession.provider}
        onBack={() => {
          setView("input");
          setChatSession(null);
        }}
      />
    );
  }

  return null;
}

