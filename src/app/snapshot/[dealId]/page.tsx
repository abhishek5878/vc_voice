import { notFound } from "next/navigation";
import { getDealPublic, getDealRunsForSnapshot } from "@/lib/deals/db";
import type { DealRun } from "@/lib/deals/types";

function riskLabel(riskScore: number | null): string {
  if (riskScore == null) return "—";
  if (riskScore <= 25) return "Low";
  if (riskScore <= 50) return "Medium";
  if (riskScore <= 75) return "High";
  return "Fragile";
}
function resistanceLabel(resistanceScore: number | null): string {
  if (resistanceScore == null) return "—";
  if (resistanceScore > 75) return "Strong";
  if (resistanceScore >= 50) return "Mixed";
  return "Weak";
}

function GrueRadar({ runs }: { runs: DealRun[] }) {
  const last = runs[0];
  if (!last?.grue_scores?.length) return null;
  const domains = ["growth", "retention", "unit_economics", "moat", "team"];
  const data = domains.map((d) => {
    const item = (last.grue_scores as { metric: string; domain: string; status: string }[]).find(
      (g) => g.domain === d
    );
    const v = item?.status === "mentioned" ? 100 : item?.status === "underspecified" ? 50 : 0;
    return { domain: d.replace("_", " "), value: v };
  });
  const size = 120;
  const center = size / 2;
  const points = data.map((d, i) => {
    const angle = (i / data.length) * 2 * Math.PI - Math.PI / 2;
    const r = (d.value / 100) * (center - 10);
    return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
  });
  const poly = points.join(" ");

  return (
    <svg width={size + 40} height={size + 40} className="mx-auto">
      <polygon
        points={poly}
        fill="rgba(245, 158, 11, 0.2)"
        stroke="rgb(245, 158, 11)"
        strokeWidth="1.5"
        transform={`translate(20, 20)`}
      />
      {data.map((d, i) => (
        <text
          key={d.domain}
          x={20 + center + (center - 5) * Math.cos((i / data.length) * 2 * Math.PI - Math.PI / 2)}
          y={20 + center + (center - 5) * Math.sin((i / data.length) * 2 * Math.PI - Math.PI / 2)}
          textAnchor="middle"
          className="fill-zinc-400 text-[10px]"
        >
          {d.domain}
        </text>
      ))}
    </svg>
  );
}

export default async function SnapshotPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const deal = await getDealPublic(dealId);
  if (!deal) notFound();
  const runs = await getDealRunsForSnapshot(dealId);
  const lastRun = runs[0];
  const redFlags = (lastRun?.red_flags ?? []) as { question: string }[];
  const topRed = redFlags.slice(0, 3).map((r) => (r.question ?? "").replace(/\n/g, " ").trim().slice(0, 160));
  const riskScore = lastRun?.risk_score ?? null;
  const clarityScore = lastRun?.clarity_score != null ? Math.round(lastRun.clarity_score) : null;
  const resistanceScore = lastRun?.resistance_score ?? null;
  const companyDisplay = deal.company_name && deal.company_name !== "Unknown" ? deal.company_name : "Unnamed company";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 flex flex-col items-center">
      <div className="max-w-lg w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-6">
        <h1 className="text-xl font-semibold text-zinc-200">{companyDisplay}</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
            <p className="text-zinc-500 text-xs uppercase mb-0.5">Clarity</p>
            <p className="text-zinc-200 font-medium">
              {clarityScore != null ? `${clarityScore} / 100` : "—"}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
            <p className="text-zinc-500 text-xs uppercase mb-0.5">Risk</p>
            <p
              className={
                riskScore != null && riskScore > 75
                  ? "text-red-400 font-medium"
                  : riskScore != null && riskScore > 50
                    ? "text-amber-400 font-medium"
                    : riskScore != null && riskScore > 25
                      ? "text-cyan-400 font-medium"
                      : "text-emerald-400 font-medium"
              }
            >
              {riskLabel(riskScore)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
            <p className="text-zinc-500 text-xs uppercase mb-0.5">Resistance</p>
            <p className="text-zinc-200 font-medium">{resistanceLabel(resistanceScore)}</p>
          </div>
        </div>
        {topRed.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-zinc-400 mb-2">Top red flags</h2>
            <ul className="list-disc list-inside space-y-1 text-sm text-zinc-300">
              {topRed.map((line, i) => (
                <li key={i}>{line}{line.length >= 160 ? "…" : ""}</li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <h2 className="text-sm font-medium text-zinc-400 mb-2">GRUE coverage</h2>
          <GrueRadar runs={runs} />
        </div>
        <p className="text-xs text-zinc-500 text-center pt-4">PitchRobin · Belief Map snapshot</p>
      </div>
    </div>
  );
}
