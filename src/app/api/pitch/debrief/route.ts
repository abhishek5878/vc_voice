/**
 * POST /api/pitch/debrief
 * Body: { dealId, slug, transcript }
 * Validates deal + slug, persists transcript, runs LLM analysis, returns headline/scores/narrative/key moments + pre-meeting context for delta.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getDealRunsForResult } from "@/lib/deals/db";
import { insertDebrief, updateDebriefResult } from "@/lib/debrief/db";
import { runDebriefAnalysis } from "@/lib/debrief/analyze";
import { listOtherVcProfiles, runVcMatching } from "@/lib/debrief/vcMatching";
import type { PreMeetingContext } from "@/lib/debrief/types";
import type { DebriefAnalysis } from "@/lib/debrief/types";
import type { DealRun } from "@/lib/deals/types";

function riskLabel(riskScore: number): string {
  if (riskScore >= 75) return "Fragile";
  if (riskScore >= 50) return "High";
  if (riskScore >= 25) return "Medium";
  return "Low";
}

function resistanceLabel(resistanceScore: number): string {
  if (resistanceScore >= 75) return "Strong";
  if (resistanceScore >= 50) return "Mixed";
  return "Weak";
}

function buildPreContext(dealId: string, runs: DealRun[]): PreMeetingContext | null {
  const last = runs[0];
  if (!last) return null;
  const redFlags = (last.red_flags ?? []) as { question?: string }[];
  return {
    clarity_score: last.clarity_score ?? null,
    risk_score: last.risk_score ?? null,
    resistance_score: last.resistance_score ?? null,
    risk_label: riskLabel(last.risk_score ?? 0),
    resistance_label: resistanceLabel(last.resistance_score ?? 0),
    red_flags_summary: redFlags.map((r) => (r.question ?? "").replace(/\n/g, " ").slice(0, 120)),
  };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server OPENAI_API_KEY is not configured." },
      { status: 500 }
    );
  }

  let body: { dealId?: string; slug?: string; transcript?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dealId = typeof body.dealId === "string" ? body.dealId.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.toLowerCase().trim() : "";
  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";

  if (!dealId || !slug) {
    return NextResponse.json({ error: "Missing dealId or slug" }, { status: 400 });
  }
  if (transcript.length < 50) {
    return NextResponse.json(
      { error: "Transcript too short. Paste at least a few sentences from your call." },
      { status: 400 }
    );
  }

  const supabase = createAdminSupabase();
  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select("id, user_id")
    .eq("id", dealId)
    .maybeSingle();

  if (dealError || !deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("robin_profiles")
    .select("slug")
    .eq("user_id", deal.user_id)
    .maybeSingle();

  if (!profile || (profile.slug as string)?.toLowerCase() !== slug) {
    return NextResponse.json({ error: "Deal does not match this pitch page" }, { status: 404 });
  }

  const runs = await getDealRunsForResult(dealId);
  const preContext = buildPreContext(dealId, runs);

  try {
    const debrief = await insertDebrief(supabase, dealId, transcript, null);
    let analysis: DebriefAnalysis | null = await runDebriefAnalysis(transcript, apiKey, preContext);
    if (analysis) {
      const otherVcs = await listOtherVcProfiles(supabase, deal.user_id as string);
      const recommended = await runVcMatching(analysis, otherVcs, apiKey);
      analysis = { ...analysis, recommended_vcs: recommended };
      await updateDebriefResult(supabase, debrief.id, analysis);
    }
    return NextResponse.json({
      status: "received",
      analysis: analysis ?? null,
      pre_meeting: preContext ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Analysis failed", detail: message },
      { status: 500 }
    );
  }
}
