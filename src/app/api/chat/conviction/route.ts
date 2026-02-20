/**
 * POST /api/chat/conviction
 * Body: { messages: { role, content }[], deckText?: string }
 * Returns: { confidence_score: number, message_signals: { message_index: number, signal: string }[] }
 * Used by FounderChat for Conviction Bar and heat map (red/yellow/green per founder message).
 */
import { NextRequest, NextResponse } from "next/server";
import { callLLMServer } from "@/lib/llm/callServer";

type Signal = "narrative_collapse" | "needs_evidence" | "strong_signal";

interface ConvictionResponse {
  confidence_score: number;
  message_signals: { message_index: number; signal: Signal }[];
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server OPENAI_API_KEY is not configured." },
      { status: 500 }
    );
  }

  let body: { messages?: { role: string; content: string }[]; deckText?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const deckText = typeof body.deckText === "string" ? body.deckText.slice(0, 8000) : "";

  if (messages.length < 2) {
    return NextResponse.json(
      { error: "Need at least two messages to evaluate conviction." },
      { status: 400 }
    );
  }

  const systemPrompt = `You are evaluating a founder pitch stress-test conversation. Output ONLY valid JSON, no markdown.

1) confidence_score: number 0-100. How much does the VC (Robin) have conviction in this founder based on the conversation so far? 0 = narrative collapsed, 100 = strong evidence and clarity.
2) message_signals: for each FOUNDER message (user/founder), classify the signal. Use message_index: 0-based index of that message in the full messages array (only founder messages get an entry).
   - "narrative_collapse": claim contradicted, hand-waving, or major red flag.
   - "needs_evidence": claim made but not backed; needs data or source.
   - "strong_signal": clear, specific, or evidence-backed.

Return exactly: {"confidence_score": number, "message_signals": [{"message_index": number, "signal": "narrative_collapse"|"needs_evidence"|"strong_signal"}, ...]}
Only include entries for founder (user) messages. message_index is the index of that message in the messages array.`;

  const userPrompt = `Conversation (message index in brackets for each turn):
${messages.map((m, i) => `[${i}] ${m.role === "user" ? "Founder" : "VC"}: ${(m.content || "").trim().slice(0, 500)}`).join("\n\n")}
${deckText ? `\nDeck excerpt (for context):\n${deckText.slice(0, 2000)}` : ""}

Output JSON only.`;

  try {
    const { content } = await callLLMServer({
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      jsonMode: true,
    });

    const raw = content.replace(/^```json?\s*|\s*```$/g, "").trim();
    let result: ConvictionResponse;
    try {
      result = JSON.parse(raw) as ConvictionResponse;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON from conviction model." },
        { status: 500 }
      );
    }

    const confidence_score = Math.max(0, Math.min(100, Number(result.confidence_score) || 50));
    const message_signals = Array.isArray(result.message_signals)
      ? result.message_signals
          .filter(
            (s): s is { message_index: number; signal: Signal } =>
              typeof s.message_index === "number" &&
              ["narrative_collapse", "needs_evidence", "strong_signal"].includes(String(s.signal))
          )
          .map((s) => ({ message_index: s.message_index, signal: s.signal }))
      : [];

    return NextResponse.json({ confidence_score, message_signals });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Conviction evaluation failed.", detail: message },
      { status: 500 }
    );
  }
}
