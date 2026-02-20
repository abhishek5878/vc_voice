/**
 * POST /api/pitch/submit
 * Body: { slug, companyName, pitchText }
 * Resolves slug → VC user_id, creates deal (status=inbound), runs pipeline, persists deal_run + founder_claims.
 * No auth (public founders submitting to VC).
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { buildVoiceProfileText } from "@/lib/voice/profile";
import { runPipeline } from "@/lib/pipeline/run";
import { MIN_INPUT_CHARS } from "@/lib/ingest/parse";
import {
  insertDealRunWithClient,
  insertFounderClaimsWithClient,
} from "@/lib/deals/db";
import { extractClaims } from "@/lib/deals/persist";
import type { StreamContext } from "@/lib/ingest/types";

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server OPENAI_API_KEY is not configured." },
      { status: 500 }
    );
  }

  let body: { slug?: string; companyName?: string; pitchText?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.toLowerCase().trim() : "";
  let companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  const pitchText = typeof body.pitchText === "string" ? body.pitchText.trim() : "";
  if (!companyName && pitchText) {
    const firstLine = pitchText.split(/\n/).find((l) => l.trim().length > 0)?.trim().slice(0, 80) ?? "";
    companyName = firstLine || "Unnamed company";
  }
  if (!companyName) companyName = "Unnamed company";

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }
  if (pitchText.length < MIN_INPUT_CHARS) {
    return NextResponse.json(
      { error: "Pitch text too short. Add more detail for a meaningful analysis." },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();
  const { data: profile, error: profileError } = await admin
    .from("robin_profiles")
    .select("user_id, bio, voice_profile")
    .eq("slug", slug)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Pitch link not found or invalid." }, { status: 404 });
  }

  const userId = profile.user_id as string;
  const voiceProfileText = buildVoiceProfileText(profile);

  const streamContext: StreamContext = { PITCH_MATERIAL: pitchText };

  try {
    const result = await runPipeline({
      streamContext,
      mode: 3,
      apiKey,
      provider: "openai",
      voiceProfile: voiceProfileText,
    });

    const { data: deal, error: dealError } = await admin
      .from("deals")
      .insert({
        user_id: userId,
        company_name: companyName,
        status: "inbound",
      })
      .select("id")
      .single();

    if (dealError || !deal) {
      return NextResponse.json(
        { error: "Failed to create submission.", detail: dealError?.message },
        { status: 500 }
      );
    }

    const run = await insertDealRunWithClient(admin, deal.id, result);
    const claims = extractClaims(result);
    await insertFounderClaimsWithClient(admin, deal.id, run.id, claims.map((c) => ({
      claim: c.claim,
      source_quote: c.source_quote,
      status: c.status,
    })));

    return NextResponse.json({
      dealId: deal.id,
      message: "Pitch submitted. The investor will review it in their dashboard.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Submission failed", detail: message },
      { status: 500 }
    );
  }
}
