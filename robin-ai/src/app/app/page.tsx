"use client";

import { useCallback, useState } from "react";
import ModeSelect from "@/components/ModeSelect";
import InputInterface from "@/components/InputInterface";
import PipelineProgress from "@/components/PipelineProgress";
import AnalysisReport from "@/components/AnalysisReport";
import type { PipelineResult } from "@/lib/pipeline/types";
import type { StreamContext } from "@/lib/ingest/types";
import type { SessionMetadata } from "@/lib/sessionMetadata";

type View = "mode" | "input" | "progress" | "report";

export default function AppPage() {
  const [view, setView] = useState<View>("mode");
  const [mode, setMode] = useState<1 | 2 | 3>(1);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [progressStep, setProgressStep] = useState(0);

  const handleStartMode = useCallback((m: 1 | 2 | 3) => {
    setMode(m);
    setView("input");
  }, []);

  const handleBackToMode = useCallback(() => {
    setView("mode");
    setResult(null);
  }, []);

  const handleRun = useCallback(
    async (streamContext: StreamContext, metadata: SessionMetadata) => {
      setView("progress");
      setProgressStep(0);
      const interval = setInterval(() => {
        setProgressStep((s) => Math.min(3, s + 1));
      }, 1200);
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            streamContext,
            mode,
            provider: "openai",
            companyName: metadata.companyName || undefined,
          }),
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

  return null;
}
