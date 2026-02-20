"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseAccessToken } from "@/lib/deals/supabase-auth";
import type { Deal } from "@/lib/deals/types";

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vertical, setVertical] = useState<string>("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getSupabaseAccessToken();
      if (!token) {
        setError("Sign in to view deals.");
        setLoading(false);
        return;
      }
      try {
        const url = vertical
          ? `/api/deals?vertical=${encodeURIComponent(vertical)}`
          : "/api/deals";
        const res = await fetch(url, {
          headers: { "x-supabase-access-token": token },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || ` ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) setDeals(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load deals");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vertical, retryCount]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="sticky top-0 z-10 p-4 sm:p-6 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/app"
              className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
            >
              ← Back to Robin
            </Link>
            <h1 className="text-lg font-semibold tracking-tight">Deal History</h1>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500">Vertical</label>
            <input
              type="text"
              value={vertical}
              onChange={(e) => setVertical(e.target.value)}
              placeholder="Filter..."
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm w-32"
            />
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto w-full p-4 sm:p-6 flex-1">
        {loading && (
          <p className="text-zinc-500 text-sm">Loading deals…</p>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm" role="alert" aria-live="assertive" aria-atomic="true">
            <p>{error}</p>
            <div className="mt-2 flex gap-3">
              <button type="button" onClick={() => { setError(null); setLoading(true); setRetryCount((c) => c + 1); }} className="text-cyan-400 hover:text-cyan-300 text-xs font-medium">Try again</button>
              <Link href="/app" className="text-cyan-400 hover:text-cyan-300 text-xs font-medium">Back to PitchRobin</Link>
            </div>
          </div>
        )}
        {!loading && !error && deals.length === 0 && (
          <div className="text-center py-8">
            <p className="text-zinc-500 text-sm mb-4">No deals yet. Run an analysis with a company name to create one.</p>
            <Link href="/app" className="inline-flex px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-900 text-sm font-medium">
              Run your first analysis
            </Link>
          </div>
        )}
        {!loading && !error && deals.length > 0 && (
          <ul className="space-y-2">
            {deals.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/app/deals/${d.id}`}
                  className="block p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-zinc-200">{d.company_name && d.company_name !== "Unknown" ? d.company_name : "Unnamed company"}</span>
                    <span className="text-xs text-zinc-500">
                      {new Date(d.updated_at).toLocaleDateString()} · {d.status}
                      {d.outcome ? ` · ${d.outcome}` : ""}
                    </span>
                  </div>
                  {d.vertical && (
                    <p className="text-xs text-zinc-500 mt-1">{d.vertical}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
