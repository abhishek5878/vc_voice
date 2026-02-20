import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getDealByIdForResult, getDealRunsForResult } from "@/lib/deals/db";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sessionId } = await params;
  const deal = await getDealByIdForResult(sessionId);
  if (!deal || !deal.share_public) {
    return { title: "Result · PitchRobin" };
  }
  const runs = await getDealRunsForResult(sessionId);
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
      url: `https://pitchrobin.work/snapshot/${sessionId}`,
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

  if (deal.share_public) {
    redirect(`/snapshot/${sessionId}`);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <p className="text-zinc-400 text-sm">This result is private.</p>
        <p className="text-zinc-500 text-xs mt-2">The investor has not enabled public sharing for this Belief Map. Enable &quot;Allow public snapshot&quot; on the deal to share.</p>
        <Link
          href="/app"
          className="inline-block mt-6 text-cyan-400 hover:text-cyan-300 text-sm"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
