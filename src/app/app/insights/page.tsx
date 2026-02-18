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
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-zinc-500 mb-0.5">
        <span>{label}</span>
        <span>{typeof value === "number" && !Number.isNaN(value) ? value.toFixed(0) : "—"}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div className="h-full rounded-full bg-amber-500/70" style={{ width: `${pct}%` }} />
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
        <Link href="/app" className="text-amber-400 text-sm mt-2 inline-block">← Back</Link>
      </div>
    );
  }
  if (!data) return null;

  const failedEntries = Object.entries(data.redFlagFrequencyFailed).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const successEntries = Object.entries(data.redFlagFrequencySuccess).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="sticky top-0 z-10 p-4 sm:p-6 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/app" className="text-zinc-400 hover:text-zinc-200 text-sm">← Back to Robin</Link>
          <h1 className="text-lg font-semibold tracking-tight">Insights</h1>
        </div>
      </header>
      <main className="max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-8">
        <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Average clarity score by outcome</h2>
          <div className="space-y-3 max-w-xs">
            <BarChart value={data.avgClarityWinners} label="Winners (3x, 10x)" />
            <BarChart value={data.avgClarityFailed} label="Failed" />
            <BarChart value={data.avgClarityDeclined} label="Declined" />
          </div>
        </section>

        <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Average risk score by outcome</h2>
          <div className="space-y-3 max-w-xs">
            {Object.entries(data.avgRiskByOutcome).length === 0 && (
              <p className="text-zinc-500 text-sm">Mark deal outcomes to see risk by outcome.</p>
            )}
            {Object.entries(data.avgRiskByOutcome).map(([outcome, avg]) => (
              <BarChart key={outcome} value={avg} label={outcome} />
            ))}
          </div>
        </section>

        <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
          <h2 className="text-sm font-medium text-zinc-400 mb-2">Most predictive GRUE dimension</h2>
          <p className="text-zinc-200">{data.topGrueDimension ?? "—"}</p>
        </section>

        <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
          <h2 className="text-sm font-medium text-red-400/90 mb-3">Red flag frequency in failed vs winners</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-zinc-500 mb-2">Failed deals</p>
              {failedEntries.length === 0 && <p className="text-zinc-500 text-sm">No data yet.</p>}
              {failedEntries.slice(0, 8).map(([label, count]) => (
                <BarChart key={label} value={count} max={Math.max(1, ...Object.values(data.redFlagFrequencyFailed))} label={label.slice(0, 40) + (label.length > 40 ? "…" : "")} />
              ))}
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-2">Winners</p>
              {successEntries.length === 0 && <p className="text-zinc-500 text-sm">No data yet.</p>}
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
