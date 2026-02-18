/**
 * POST /api/analyze
 * Body: { streamContext, mode: 1|2|3, provider?, model?, companyName?, supabaseAccessToken? }
 * Header: Authorization: Bearer <user API key>
 * Runs SPA pipeline and returns full report. If supabaseAccessToken + companyName, persists to deal + deal_runs.
 */
import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline/run";
import type { StreamContext } from "@/lib/ingest/types";
import { MIN_INPUT_CHARS } from "@/lib/ingest/parse";
import {
  getUserIdFromRequest,
  upsertDeal,
  insertDealRun,
  insertFounderClaims,
} from "@/lib/deals/db";
import { extractClaims } from "@/lib/deals/persist";

function getApiKey(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

export async function POST(request: NextRequest) {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Provide your API key in Authorization: Bearer <key>" },
      { status: 401 }
    );
  }

  let body: {
    streamContext?: StreamContext;
    mode?: number;
    provider?: "openai" | "anthropic" | "groq";
    model?: string;
    companyName?: string;
    supabaseAccessToken?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  const supabaseAccessToken =
    typeof body.supabaseAccessToken === "string" ? body.supabaseAccessToken.trim() : null;

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
    });

    let dealId: string | null = null;
    if (supabaseAccessToken && companyName) {
      const userId = await getUserIdFromRequest(supabaseAccessToken);
      if (userId) {
        try {
          const deal = await upsertDeal(userId, companyName || "Unknown");
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
