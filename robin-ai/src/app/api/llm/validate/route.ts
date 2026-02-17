/**
 * POST /api/llm/validate — Key validation (test call, single token).
 * Body: { provider, model? }
 * Header: Authorization: Bearer <key>
 * Returns: { valid: true } or 401 with message.
 */
import { NextRequest, NextResponse } from "next/server";
import { callLLMServer } from "@/lib/llm/callServer";
import { PROVIDER_MODELS, type LLMProvider } from "@/lib/llm/types";

function getApiKey(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

export async function POST(request: NextRequest) {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return NextResponse.json(
      { valid: false, error: "Missing Authorization: Bearer <key>" },
      { status: 401 }
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
