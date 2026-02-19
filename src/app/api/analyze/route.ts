/**
 * POST /api/analyze
 * Body: { streamContext, mode: 1|2|3, provider?, model?, companyName? }
 * Auth: user from passcode cookie (ROBIN_USER_ID) or x-supabase-access-token. Uses server OPENAI_API_KEY for LLM.
 * Persists to deal + deal_runs when user and companyName present.
 */
import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline/run";
import type { StreamContext } from "@/lib/ingest/types";
import { MIN_INPUT_CHARS } from "@/lib/ingest/parse";
import { getUserIdFromRequest, upsertDeal, insertDealRun, insertFounderClaims } from "@/lib/deals/db";
import { getRobinProfile } from "@/lib/voice/profile";
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
  const userIdForDeals = await getUserIdFromRequest(request);
  if (userIdForDeals) {
    try {
      const profile = await getRobinProfile(userIdForDeals);
      if (profile?.voice_profile) {
        const vp = profile.voice_profile;
        const parts: string[] = [];
        if (vp.tone) parts.push(`Tone: ${vp.tone}`);
        if (vp.evaluation_heuristics?.length) {
          parts.push(
            `How they evaluate inbound:\n- ${vp.evaluation_heuristics.slice(0, 6).join("\n- ")}`
          );
        }
        if (vp.green_flags?.length) {
          parts.push(`Green flags:\n- ${vp.green_flags.slice(0, 5).join("\n- ")}`);
        }
        if (vp.red_flags?.length) {
          parts.push(`Red flags they often mention:\n- ${vp.red_flags.slice(0, 5).join("\n- ")}`);
        }
        if (vp.favorite_phrases?.length) {
          parts.push(`Typical phrases:\n- ${vp.favorite_phrases.slice(0, 4).join("\n- ")}`);
        }
        voiceProfile = parts.join("\n\n");
      } else if (profile?.bio) {
        voiceProfile = profile.bio;
      }
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
    if (companyName && userIdForDeals) {
      try {
        const deal = await upsertDeal(userIdForDeals, companyName || "Unknown");
        dealId = deal.id;
        const run = await insertDealRun(deal.id, result);
        const claims = extractClaims(result);
        await insertFounderClaims(
          deal.id,
          run.id,
          claims.map((c) => ({
            claim: c.claim,
            source_quote: c.source_quote,
            status: c.status,
          }))
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
