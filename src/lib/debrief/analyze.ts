/**
 * Post-call transcript analysis: headline, scores, narrative, key moments.
 * Uses OpenAI with JSON output. Optional pre-meeting context for PRE/POST delta.
 */
import OpenAI from "openai";
import type { DebriefAnalysis, PreMeetingContext } from "./types";

const SYSTEM_PROMPT = `You are an expert VC analyst. You analyze pitch call transcripts and produce a structured debrief.

Output valid JSON only, no markdown or extra text. Use this exact structure:
{
  "headline": "One sentence verdict (e.g. 'Strong founder-market fit with real traction; pushback on retention.')",
  "scores": {
    "overall": 0,
    "clarity": 0,
    "vision": 0,
    "unfair_edge": 0
  },
  "score_reasons": {
    "overall": "One line why this overall score.",
    "clarity": "One line for clarity.",
    "vision": "One line for vision.",
    "unfair_edge": "One line for unfair edge."
  },
  "narrative": {
    "resonated": ["point 1", "point 2"],
    "lost_them": ["point 1", "point 2"]
  },
  "key_moments": {
    "nailed": [{"quote": "exact quote from transcript", "summary": "what went well"}],
    "needs_work": [{"quote": "exact quote", "summary": "what to improve"}]
  }
}

Scores are 1-100. Be specific: pull short quotes from the transcript for key_moments. Keep resonated/lost_them to 2-4 bullets each, and 2-4 moments each for nailed/needs_work.`;

function buildUserPrompt(transcript: string, preContext: PreMeetingContext | null): string {
  let prompt = `Analyze this pitch call transcript.\n\n---\n${transcript}\n---`;
  if (preContext) {
    const pre = [
      preContext.clarity_score != null ? `Pre-meeting clarity score: ${Math.round(preContext.clarity_score)}/100` : null,
      preContext.risk_label ? `Pre-meeting risk: ${preContext.risk_label}` : null,
      preContext.resistance_label ? `Pre-meeting resistance: ${preContext.resistance_label}` : null,
      preContext.red_flags_summary?.length
        ? `Pre-meeting red flags: ${preContext.red_flags_summary.slice(0, 3).join("; ")}`
        : null,
    ]
      .filter(Boolean)
      .join(". ");
    if (pre) prompt += `\n\nContext from pre-meeting prep: ${pre}. Use this to compare what was predicted vs what actually happened in the call.`;
  }
  return prompt;
}

function parseAnalysis(raw: string): DebriefAnalysis | null {
  const trimmed = raw.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const o = JSON.parse(trimmed) as DebriefAnalysis;
    if (!o.headline || !o.scores || !o.narrative || !o.key_moments) return null;
    return o;
  } catch {
    return null;
  }
}

export async function runDebriefAnalysis(
  transcript: string,
  apiKey: string,
  preContext: PreMeetingContext | null
): Promise<DebriefAnalysis | null> {
  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(transcript, preContext) },
    ],
    response_format: { type: "json_object" },
  });
  const content = completion.choices?.[0]?.message?.content;
  if (!content) return null;
  return parseAnalysis(content);
}
