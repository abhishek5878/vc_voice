/**
 * POST /api/analyze
 * Body: { streamContext, mode: 1|2|3, provider?, model?, companyName? }
 * Auth: x-supabase-access-token. Uses server OPENAI_API_KEY for LLM.
 * Persists to deal + deal_runs when user and companyName present (user-scoped client for RLS).
 */
import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline/run";
import type { StreamContext } from "@/lib/ingest/types";
import { MIN_INPUT_CHARS } from "@/lib/ingest/parse";
import { getUserIdFromRequest, upsertDeal, insertDealRun, insertFounderClaims } from "@/lib/deals/db";
import { createServerSupabaseWithToken } from "@/lib/supabase/server";
import { getRobinProfile, buildVoiceProfileText } from "@/lib/voice/profile";
import { extractClaims } from "@/lib/deals/persist";

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server OPENAI_API_KEY is not configured." },
      { status: 500 }
    );
  }

  let body: {
    streamContext?: StreamContext;
    mode?: number;
    provider?: "openai" | "anthropic" | "groq";
    model?: string;
    companyName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";

  let voiceProfile: string | null = null;
  const token = request.headers.get("x-supabase-access-token")?.trim() ?? null;
  const userIdForDeals = await getUserIdFromRequest(request);
  if (userIdForDeals) {
    try {
      const supabaseForProfile = token ? createServerSupabaseWithToken(token) : null;
      const profile = await getRobinProfile(userIdForDeals, supabaseForProfile ?? undefined);
      voiceProfile = profile ? (buildVoiceProfileText(profile) ?? null) : null;
    } catch {
      // Voice profile fetch failure should not break analysis
    }
  }

  const streamContext = body.streamContext ?? {};
  const mode = Math.min(3, Math.max(1, Number(body.mode) || 1)) as 1 | 2 | 3;
  const provider = body.provider === "anthropic" || body.provider === "groq" ? body.provider : "openai";
  const model = typeof body.model === "string" ? body.model : undefined;

  const totalChars = Object.values(streamContext).reduce((s, v) => s + (typeof v === "string" ? v.length : 0), 0);
  if (totalChars < MIN_INPUT_CHARS) {
    return NextResponse.json(
      { error: "Input too short for meaningful analysis. Paste your full transcript or pitch narrative." },
      { status: 400 }
    );
  }

  const hasPublic = Boolean(streamContext.PUBLIC_TRANSCRIPT?.trim());
  const hasPrivate = Boolean(streamContext.PRIVATE_DICTATION?.trim());
  const hasPitch = Boolean(streamContext.PITCH_MATERIAL?.trim());
  if (!hasPublic && !hasPrivate && !hasPitch) {
    return NextResponse.json(
      { error: "Provide at least one of: PUBLIC_TRANSCRIPT, PRIVATE_DICTATION, PITCH_MATERIAL." },
      { status: 400 }
    );
  }

  try {
    const result = await runPipeline({
      streamContext,
      mode,
      apiKey,
      provider,
      model,
      voiceProfile,
    });

    let dealId: string | null = null;
    if (companyName && userIdForDeals && token) {
      try {
        const supabase = createServerSupabaseWithToken(token);
        const deal = await upsertDeal(userIdForDeals, companyName || "Unknown", undefined, supabase);
        dealId = deal.id;
        const run = await insertDealRun(deal.id, result, supabase);
        const claims = extractClaims(result);
        await insertFounderClaims(
          deal.id,
          run.id,
          claims.map((c) => ({
            claim: c.claim,
            source_quote: c.source_quote,
            status: c.status,
          })),
          supabase
        );
      } catch {
        // Persist failure does not fail the request; result still returned
      }
    }

    return NextResponse.json(dealId ? { ...result, dealId } : result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Analysis failed", detail: message },
      { status: 500 }
    );
  }
}
