"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseAccessToken } from "@/lib/deals/supabase-auth";

interface InsightsData {
  redFlagFrequencyFailed: Record<string, number>;
  redFlagFrequencySuccess: Record<string, number>;
  avgClarityWinners: number;
  avgClarityFailed: number;
  avgClarityDeclined: number;
  avgRiskByOutcome: Record<string, number>;
  topGrueDimension: string | null;
}

function BarChart({ value, max = 100, label }: { value: number; max?: number; label: string }) {
  const num = typeof value === "number" && !Number.isNaN(value) ? value : 0;
  const pct = max > 0 && num >= 0 ? Math.min(100, (num / max) * 100) : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-zinc-500 mb-0.5">
        <span>{label}</span>
        <span>{num > 0 || value === 0 ? (num === 0 ? "0" : num.toFixed(0)) : "—"}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div className="h-full rounded-full bg-cyan-500/70 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getSupabaseAccessToken();
      if (!token) {
        setError("Sign in to view insights.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/insights", {
          headers: { "x-supabase-access-token": token },
        });
        if (!res.ok) throw new Error("Failed to load");
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="min-h-screen bg-zinc-950 p-6 text-zinc-500 text-sm">Loading…</div>;
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6">
        <p className="text-red-400">{error}</p>
        <Link href="/app" className="text-cyan-400 text-sm mt-2 inline-block">← Back</Link>
      </div>
    );
  }
  if (!data) return null;

  const failedEntries = Object.entries(data.redFlagFrequencyFailed).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const successEntries = Object.entries(data.redFlagFrequencySuccess).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const hasAnyOutcome = Object.keys(data.avgRiskByOutcome ?? {}).length > 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="sticky top-0 z-10 p-4 sm:p-6 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/app" className="text-zinc-400 hover:text-zinc-200 text-sm">← Dashboard</Link>
          <h1 className="text-lg font-semibold tracking-tight">Insights</h1>
        </div>
      </header>
      <main className="max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-8">
        <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Average clarity score by outcome</h2>
          {((data.avgClarityWinners ?? 0) === 0 && (data.avgClarityFailed ?? 0) === 0 && (data.avgClarityDeclined ?? 0) === 0) ? (
            <div className="space-y-2">
              <p className="text-zinc-500 text-sm">No data yet.</p>
              <Link href="/app/deals" className="text-sm text-cyan-400 hover:text-cyan-300">Mark your first deal outcome to start seeing patterns →</Link>
            </div>
          ) : (
            <div className="space-y-3 max-w-xs">
              <BarChart value={data.avgClarityWinners} label="Winners (3x, 10x)" />
              <BarChart value={data.avgClarityFailed} label="Failed" />
              <BarChart value={data.avgClarityDeclined} label="Declined" />
            </div>
          )}
        </section>

        <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Average risk score by outcome</h2>
          <div className="space-y-3 max-w-xs">
            {Object.entries(data.avgRiskByOutcome).length === 0 && (
              <div className="space-y-2">
                <p className="text-zinc-500 text-sm">No data yet.</p>
                <Link href="/app/deals" className="text-sm text-cyan-400 hover:text-cyan-300">Mark deal outcomes to see risk by outcome →</Link>
              </div>
            )}
            {Object.entries(data.avgRiskByOutcome).map(([outcome, avg]) => (
              <BarChart key={outcome} value={avg} label={outcome} />
            ))}
          </div>
        </section>

        <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
          <h2 className="text-sm font-medium text-zinc-400 mb-2">Most common GRUE dimension</h2>
          {hasAnyOutcome ? (
            <>
              <p className="text-zinc-200">{data.topGrueDimension ?? "—"}</p>
              <p className="text-xs text-zinc-500 mt-1">Most frequently present in your runs. Mark outcomes on deals to see predictive patterns by dimension.</p>
            </>
          ) : (
            <>
              <p className="text-zinc-200">{data.topGrueDimension ?? "—"}</p>
              <p className="text-xs text-zinc-500 mt-1">Based on score distribution across runs (not outcome correlation). Mark deal outcomes to see which dimension best predicts success.</p>
            </>
          )}
        </section>

        <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
          <h2 className="text-sm font-medium text-red-400/90 mb-3">Red flag frequency in failed vs winners</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-zinc-500 mb-2">Failed deals</p>
              {failedEntries.length === 0 && (
                <p className="text-zinc-500 text-sm">No data yet. <Link href="/app/deals" className="text-cyan-400 hover:text-cyan-300">Mark outcomes</Link> to see red flag patterns.</p>
              )}
              {failedEntries.slice(0, 8).map(([label, count]) => (
                <BarChart key={label} value={count} max={Math.max(1, ...Object.values(data.redFlagFrequencyFailed))} label={label.slice(0, 40) + (label.length > 40 ? "…" : "")} />
              ))}
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-2">Winners</p>
              {successEntries.length === 0 && (
                <p className="text-zinc-500 text-sm">No data yet. <Link href="/app/deals" className="text-cyan-400 hover:text-cyan-300">Mark outcomes</Link> to see patterns.</p>
              )}
              {successEntries.slice(0, 8).map(([label, count]) => (
                <BarChart key={label} value={count} max={Math.max(1, ...Object.values(data.redFlagFrequencySuccess))} label={label.slice(0, 40) + (label.length > 40 ? "…" : "")} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
