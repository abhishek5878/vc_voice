import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  getDealByIdForResult,
  getDealRunsForSnapshot,
  getSlugByUserId,
} from "@/lib/deals/db";

function riskLabel(riskScore: number | null): string {
  if (riskScore == null) return "—";
  if (riskScore >= 75) return "Fragile";
  if (riskScore >= 50) return "High";
  if (riskScore >= 25) return "Medium";
  return "Low";
}

function resistanceLabel(resistanceScore: number | null): string {
  if (resistanceScore == null) return "—";
  if (resistanceScore >= 75) return "Strong";
  if (resistanceScore >= 50) return "Mixed";
  return "Weak";
}

function riskColor(riskScore: number | null): string {
  if (riskScore == null) return "text-zinc-400";
  if (riskScore >= 75) return "text-red-400";
  if (riskScore >= 50) return "text-amber-400";
  if (riskScore >= 25) return "text-cyan-400";
  return "text-emerald-400";
}

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sessionId } = await params;
  const deal = await getDealByIdForResult(sessionId);
  if (!deal || !deal.share_public) {
    return { title: "Result · PitchRobin" };
  }
  const runs = await getDealRunsForSnapshot(sessionId);
  const lastRun = runs[0];
  const redFlags = (lastRun?.red_flags ?? []) as { question: string }[];
  const topRed = redFlags[0]?.question?.replace(/\n/g, " ").slice(0, 160) ?? "";
  const companyDisplay = deal.company_name && deal.company_name !== "Unknown" ? deal.company_name : "Unnamed company";

  return {
    title: `${companyDisplay} · Robin Belief Map`,
    description: topRed || "Stress-tested by Robin. See the full Belief Map.",
    openGraph: {
      title: `${companyDisplay} · Robin Belief Map`,
      description: topRed || "Stress-tested by Robin. See the full Belief Map.",
      siteName: "PitchRobin",
      url: `https://pitchrobin.work/result/${sessionId}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${companyDisplay} · Robin Belief Map`,
      description: topRed || "Stress-tested by Robin.",
    },
    robots: "index, follow",
  };
}

export default async function ResultPage({ params }: PageProps) {
  const { sessionId } = await params;
  const deal = await getDealByIdForResult(sessionId);
  if (!deal) notFound();

  if (!deal.share_public) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <p className="text-zinc-400 text-sm">This result is private.</p>
          <p className="text-zinc-500 text-xs mt-2">The investor has not enabled public sharing for this Belief Map.</p>
          <Link
            href="/"
            className="inline-block mt-6 text-cyan-400 hover:text-cyan-300 text-sm"
          >
            PitchRobin
          </Link>
        </div>
      </div>
    );
  }

  const runs = await getDealRunsForSnapshot(sessionId);
  const lastRun = runs[0];
  const redFlags = (lastRun?.red_flags ?? []) as { question: string }[];
  const topRed = redFlags.slice(0, 3).map((r) => (r.question ?? "").replace(/\n/g, " ").trim().slice(0, 120));
  const clarityScore = lastRun?.clarity_score != null ? Math.round(lastRun.clarity_score) : null;
  const riskScore = lastRun?.risk_score ?? null;
  const resistanceScore = lastRun?.resistance_score ?? null;
  const companyDisplay = deal.company_name && deal.company_name !== "Unknown" ? deal.company_name : "Unnamed company";
  const slug = await getSlugByUserId(deal.user_id);
  const pitchUrl = slug ? `https://pitchrobin.work/pitch/${slug}` : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center p-6">
      {/* Card — OG-friendly dimensions (e.g. 1200x630), readable on phone */}
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-zinc-100 mb-5">{companyDisplay}</h1>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Clarity</p>
            <p className="text-lg font-semibold text-zinc-100">
              {clarityScore != null ? `${clarityScore} / 100` : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Risk</p>
            <p className={`text-lg font-semibold ${riskColor(riskScore)}`}>
              {riskLabel(riskScore)}
            </p>
          </div>
          <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Resistance</p>
            <p className="text-lg font-semibold text-zinc-200">
              {resistanceLabel(resistanceScore)}
            </p>
          </div>
        </div>

        {topRed.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">Red flags Robin raised</h2>
            <ul className="space-y-1.5 text-sm text-zinc-300">
              {topRed.map((line, i) => (
                <li key={i} className="leading-snug">
                  {line}{line.length >= 120 ? "…" : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-zinc-500 text-center pt-2 border-t border-zinc-800">
          Stress-tested by Robin · pitchrobin.work
        </p>
      </div>

      {/* CTAs */}
      <div className="w-full max-w-md mt-8 space-y-3">
        {pitchUrl && (
          <Link
            href={`/pitch/${slug}`}
            className="block w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-900 font-semibold text-sm text-center transition-colors"
          >
            Submit your pitch
          </Link>
        )}
        <Link
          href="/"
          className="block w-full py-2 text-center text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
        >
          Built with Robin · Create your pitch link
        </Link>
      </div>
    </div>
  );
}
