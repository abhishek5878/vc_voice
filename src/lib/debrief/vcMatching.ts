/**
 * VC matching: given post-call analysis, recommend other VCs (from robin_profiles) with fit % and reason.
 * Uses admin Supabase to list profiles; LLM picks 3–5 best fits.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import type { DebriefAnalysis, RecommendedVC } from "./types";
import { buildVoiceProfileText } from "@/lib/voice/profile";
import type { RobinVoiceProfile } from "@/lib/voice/profile";

export interface VcProfileForMatch {
  user_id: string;
  slug: string;
  display_name: string | null;
  bio: string | null;
  voice_profile: unknown;
  twitter_url: string | null;
  linkedin_url: string | null;
}

export async function listOtherVcProfiles(
  supabase: SupabaseClient,
  excludeUserId: string
): Promise<VcProfileForMatch[]> {
  const { data, error } = await supabase
    .from("robin_profiles")
    .select("user_id, slug, display_name, bio, voice_profile, twitter_url, linkedin_url")
    .not("slug", "is", null)
    .neq("user_id", excludeUserId);
  if (error) throw error;
  const rows = (data ?? []) as VcProfileForMatch[];
  return rows.filter((r) => r.slug && String(r.slug).trim());
}

/** LLM returns slugs and fit/reason; we merge with profile data for links. */
interface LlmMatch {
  slug: string;
  fit_pct: number;
  reason: string;
}

function buildPitchSummary(analysis: DebriefAnalysis): string {
  const parts = [
    analysis.headline,
    `Scores: overall ${analysis.scores.overall}, clarity ${analysis.scores.clarity}, vision ${analysis.scores.vision}, unfair edge ${analysis.scores.unfair_edge}.`,
    `Resonated: ${(analysis.narrative.resonated ?? []).slice(0, 3).join("; ")}`,
    `Lost them: ${(analysis.narrative.lost_them ?? []).slice(0, 2).join("; ")}`,
  ];
  return parts.filter(Boolean).join(" ");
}

export async function runVcMatching(
  analysis: DebriefAnalysis,
  vcList: VcProfileForMatch[],
  apiKey: string
): Promise<RecommendedVC[]> {
  if (vcList.length === 0) return [];

  const pitchSummary = buildPitchSummary(analysis);
  const vcDescriptions = vcList
    .map((v) => {
      const name = (v.display_name ?? v.slug).trim();
      const thesis = buildVoiceProfileText({ voice_profile: v.voice_profile as RobinVoiceProfile | null, bio: v.bio }) ?? "";
      return `- slug: "${v.slug}" | name: ${name} | thesis/profile: ${thesis.slice(0, 400)}`;
    })
    .join("\n");

  const systemPrompt = `You are a VC analyst. Given a post-call pitch summary and a list of other VCs (with their slug and profile), pick 3–5 VCs who would be good next conversations for this founder. Consider thesis fit, stage, and style.

Output valid JSON only:
{ "recommendations": [ { "slug": "vc-slug", "fit_pct": 85, "reason": "One line why they're a fit for this pitch." }, ... ] }
fit_pct is 1-100. Use the exact slug from the list.`;

  const userPrompt = `Pitch summary:\n${pitchSummary}\n\nVCs (use exact slug):\n${vcDescriptions}`;

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });
  const content = completion.choices?.[0]?.message?.content;
  if (!content) return [];

  let parsed: { recommendations?: LlmMatch[] };
  try {
    parsed = JSON.parse(content.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim()) as {
      recommendations?: LlmMatch[];
    };
  } catch {
    return [];
  }
  const recs = parsed.recommendations ?? [];
  const bySlug = new Map(vcList.map((v) => [String(v.slug).toLowerCase(), v]));
  const result: RecommendedVC[] = [];
  for (const r of recs.slice(0, 5)) {
    const slug = String(r.slug ?? "").trim().toLowerCase();
    const vc = bySlug.get(slug);
    if (!vc) continue;
    result.push({
      slug: (vc.slug as string) ?? slug,
      display_name: (vc.display_name ?? vc.slug ?? "VC").trim(),
      twitter_url: vc.twitter_url ?? null,
      linkedin_url: vc.linkedin_url ?? null,
      fit_pct: Math.min(100, Math.max(0, Number(r.fit_pct) || 0)),
      reason: String(r.reason ?? "").trim().slice(0, 200),
    });
  }
  return result;
}
