import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

const ADMIN_SECRET = process.env.ADMIN_AGGREGATES_SECRET ?? "";

function stdDev(values: number[], avg: number): number {
  if (values.length <= 1) return 0;
  const sumSq = values.reduce((s, v) => s + (v - avg) ** 2, 0);
  return Math.sqrt(sumSq / (values.length - 1));
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-admin-secret") ?? "";
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const supabase = createAdminSupabase();
    const { data: runs, error: runsError } = await supabase
      .from("deal_runs")
      .select("deal_id, risk_score, clarity_score, resistance_score, deals(vertical, stage)");
    if (runsError) throw runsError;
    const rows = (runs ?? []) as Array<{
      deal_id: string;
      risk_score: number | null;
      clarity_score: number | null;
      resistance_score: number | null;
      deals: { vertical: string | null; stage: string | null }[] | null;
    }>;

    type Key = { vertical: string | null; stage: string | null };
    const groups = new Map<string, { risk: number[]; clarity: number[]; resistance: number[] }>();
    const keyStr = (k: Key) => `${k.vertical ?? ""}\t${k.stage ?? ""}`;

    for (const r of rows) {
      const firstDeal = Array.isArray(r.deals) ? r.deals[0] : null;
      const vertical = firstDeal?.vertical ?? null;
      const stage = firstDeal?.stage ?? null;
      const key: Key = { vertical, stage };
      const s = keyStr(key);
      if (!groups.has(s)) groups.set(s, { risk: [], clarity: [], resistance: [] });
      const g = groups.get(s)!;
      if (r.risk_score != null) g.risk.push(r.risk_score);
      if (r.clarity_score != null) g.clarity.push(r.clarity_score);
      if (r.resistance_score != null) g.resistance.push(r.resistance_score);
    }

    const toUpsert: Array<{
      metric_name: string;
      vertical: string | null;
      stage: string | null;
      avg_value: number;
      std_dev: number | null;
      sample_size: number;
    }> = [];

    groups.forEach((g, keyStrVal) => {
      const [v, st] = keyStrVal.split("\t");
      const vertical = v || null;
      const stage = st || null;
      if (g.risk.length > 0) {
        const avg = g.risk.reduce((a, b) => a + b, 0) / g.risk.length;
        toUpsert.push({
          metric_name: "risk_score",
          vertical,
          stage,
          avg_value: avg,
          std_dev: stdDev(g.risk, avg),
          sample_size: g.risk.length,
        });
      }
      if (g.clarity.length > 0) {
        const avg = g.clarity.reduce((a, b) => a + b, 0) / g.clarity.length;
        toUpsert.push({
          metric_name: "clarity_score",
          vertical,
          stage,
          avg_value: avg,
          std_dev: stdDev(g.clarity, avg),
          sample_size: g.clarity.length,
        });
      }
      if (g.resistance.length > 0) {
        const avg = g.resistance.reduce((a, b) => a + b, 0) / g.resistance.length;
        toUpsert.push({
          metric_name: "resistance_score",
          vertical,
          stage,
          avg_value: avg,
          std_dev: stdDev(g.resistance, avg),
          sample_size: g.resistance.length,
        });
      }
    });

    const { error: delError } = await supabase.from("aggregated_patterns").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (delError) throw delError;
    if (toUpsert.length > 0) {
      const { error: insError } = await supabase.from("aggregated_patterns").insert(toUpsert);
      if (insError) throw insError;
    }
    return NextResponse.json({ updated: toUpsert.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
