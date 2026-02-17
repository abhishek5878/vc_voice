"use client";

import { useCallback, useState } from "react";
import ModeSelect from "@/components/ModeSelect";
import InputInterface from "@/components/InputInterface";
import PipelineProgress from "@/components/PipelineProgress";
import AnalysisReport from "@/components/AnalysisReport";
import FounderChat from "@/components/FounderChat";
import type { PipelineResult } from "@/lib/pipeline/types";
import type { StreamContext } from "@/lib/ingest/types";

type View = "mode" | "input" | "progress" | "report" | "chat";

interface ChatSession {
  streamContext: StreamContext;
  apiKey: string;
  provider: "openai" | "anthropic" | "groq";
}

export default function AppPage() {
  const [view, setView] = useState<View>("mode");
  const [mode, setMode] = useState<1 | 2 | 3>(1);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [progressStep, setProgressStep] = useState(0);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);

  const handleStartMode = useCallback((m: 1 | 2 | 3) => {
    setMode(m);
    setView("input");
  }, []);

  const handleBackToMode = useCallback(() => {
    setView("mode");
    setResult(null);
    setChatSession(null);
  }, []);

  const handleRun = useCallback(
    async (streamContext: StreamContext, apiKey: string, provider: "openai" | "anthropic" | "groq") => {
      if (mode === 3) {
        // Founder chat mode: skip static report, go straight into live VC-style chat.
        setChatSession({ streamContext, apiKey, provider });
        setView("chat");
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
        setView("report");
      } catch (e) {
        setView("input");
        throw e;
      } finally {
        clearInterval(interval);
      }
    },
    [mode]
  );

  if (view === "mode") {
    return <ModeSelect onStart={handleStartMode} />;
  }

  if (view === "input") {
    return (
      <InputInterface
        mode={mode}
        onBack={handleBackToMode}
        onRun={handleRun}
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
        onBack={() => {
          setView("input");
          setResult(null);
        }}
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

