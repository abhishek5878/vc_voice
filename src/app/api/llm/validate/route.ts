/**
 * POST /api/llm/validate — Sanity-check server OPENAI_API_KEY (single token call).
 * Body: { provider, model? }
 * Returns: { valid: true } or error.
 */
import { NextRequest, NextResponse } from "next/server";
import { callLLMServer } from "@/lib/llm/callServer";
import { PROVIDER_MODELS, type LLMProvider } from "@/lib/llm/types";

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { valid: false, error: "Server OPENAI_API_KEY is not configured." },
      { status: 500 }
    );
  }

  let body: { provider?: string; model?: string } = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {}

  const provider = (body.provider === "anthropic" || body.provider === "groq" ? body.provider : "openai") as LLMProvider;
  const model = body.model || PROVIDER_MODELS[provider]?.default;

  try {
    await callLLMServer({
      provider,
      model,
      apiKey,
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      jsonMode: false,
    });
    return NextResponse.json({ valid: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("401") || msg.includes("API key") || msg.includes("Incorrect")) {
      return NextResponse.json(
        { valid: false, error: "Key invalid — check and retry" },
        { status: 401 }
      );
    }
    if (msg.includes("429")) {
      return NextResponse.json(
        { valid: false, error: "Rate limit — wait 60s and retry" },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { valid: false, error: msg.slice(0, 200) },
      { status: 502 }
    );
  }
}
