import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { callLLMServer } from "@/lib/llm/callServer";
import type { LLMProvider } from "@/lib/llm/types";
import { scrapeUrlsWithTimeBudget } from "./firecrawl";

export interface RobinVoiceProfile {
  tone: string;
  evaluation_heuristics: string[];
  favorite_phrases: string[];
  red_flags: string[];
  green_flags: string[];
  /** 2–3 sentences: how they sound, what they’d never say, sentence patterns. Makes the bot sound like them, not a generic VC. */
  persona_summary?: string;
  /** Typical first questions or probes they use when evaluating founders. */
  typical_questions?: string[];
}

export interface RobinProfileRow {
  user_id: string;
  slug?: string | null;
  email?: string | null;
  bio: string | null;
  tone: string | null;
  decision_style: string | null;
  twitter_url: string | null;
  linkedin_url: string | null;
  substack_url: string | null;
  blog_url: string | null;
  podcast_url: string | null;
  extra_urls: unknown | null;
  voice_profile: RobinVoiceProfile | null;
  last_scraped_at: string | null;
  scrape_status: string | null;
  scrape_error: string | null;
}

export async function getRobinProfile(
  userId: string,
  supabase?: SupabaseClient
): Promise<RobinProfileRow | null> {
  const client = supabase ?? (await createServerSupabase());
  const { data } = await client
    .from("robin_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as RobinProfileRow | null) ?? null;
}

export async function upsertRobinProfile(
  userId: string,
  updates: Partial<Omit<RobinProfileRow, "user_id">>,
  supabase?: SupabaseClient
): Promise<RobinProfileRow> {
  const client = supabase ?? (await createServerSupabase());
  const payload = { user_id: userId, ...updates };
  const { data, error } = await client
    .from("robin_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data as RobinProfileRow;
}

function buildVoicePrompt(corpus: string, manualText?: string): string {
  const extra = manualText?.trim()
    ? `\n\nThe user also provided this direct description of how they think about inbound and founders:\n${manualText.trim()}\n`
    : "";
  return `You are building a deep "voice profile" for a VC so an AI can speak exactly like them.

You will be given samples of their writing and public content.${extra}

Extract:

1) tone: A few words (e.g. "Skeptical, dry, numbers-obsessed" or "Supportive but direct").
2) evaluation_heuristics: How they decide, what they look for, what they avoid. Be specific.
3) favorite_phrases: Exact phrases or stylistic tics they use (quotes, pet words, sentence openers).
4) red_flags: What they often call out or hate.
5) green_flags: What they reward or highlight.
6) persona_summary: 2–4 sentences that capture HOW they sound: typical sentence structure, what they would never say, how they push back, how they encourage. This is the most important field for making the AI sound like this person, not a generic VC.
7) typical_questions: 4–8 questions or probes they typically ask founders (exact or close to their wording). Used to open and steer the conversation in their voice.

Return ONLY valid JSON in this schema:
{
  "tone": "string",
  "evaluation_heuristics": ["string", "..."],
  "favorite_phrases": ["string", "..."],
  "red_flags": ["string", "..."],
  "green_flags": ["string", "..."],
  "persona_summary": "string",
  "typical_questions": ["string", "..."]
}

You may omit persona_summary or typical_questions only if the corpus gives no signal. Otherwise include them.

Corpus:

${corpus.slice(0, 60_000)}`;
}

/** Normalize voice_profile (DB may return object or JSON string). */
function normalizeVoiceProfile(
  raw: unknown
): RobinVoiceProfile | null {
  if (raw == null) return null;
  let vp = raw;
  if (typeof vp === "string") {
    try {
      vp = JSON.parse(vp) as RobinVoiceProfile;
    } catch {
      return null;
    }
  }
  if (typeof vp !== "object" || vp === null) return null;
  const o = vp as Record<string, unknown>;
  const hasContent =
    (typeof o.tone === "string" && o.tone.trim() !== "") ||
    (Array.isArray(o.evaluation_heuristics) && o.evaluation_heuristics.length > 0) ||
    (Array.isArray(o.green_flags) && o.green_flags.length > 0) ||
    (Array.isArray(o.red_flags) && o.red_flags.length > 0) ||
    (Array.isArray(o.favorite_phrases) && o.favorite_phrases.length > 0) ||
    (typeof o.persona_summary === "string" && o.persona_summary.trim() !== "") ||
    (Array.isArray(o.typical_questions) && o.typical_questions.length > 0);
  return hasContent ? (vp as RobinVoiceProfile) : null;
}

/** Build a single text block for system prompts from profile row (voice_profile + bio). Prioritises depth so the bot sounds like the VC. */
export function buildVoiceProfileText(profile: {
  voice_profile?: RobinVoiceProfile | null;
  bio?: string | null;
}): string | null {
  const vp = normalizeVoiceProfile(profile?.voice_profile);
  if (!vp) return (profile?.bio?.trim() ?? "") || null;
  const parts: string[] = [];
  if (typeof vp.persona_summary === "string" && vp.persona_summary.trim()) {
    parts.push(`Persona (speak exactly like this):\n${vp.persona_summary.trim()}`);
  }
  if (vp.tone?.trim()) parts.push(`Tone: ${vp.tone.trim()}`);
  if (Array.isArray(vp.typical_questions) && vp.typical_questions.length > 0) {
    parts.push(`Questions they typically ask:\n- ${vp.typical_questions.slice(0, 6).join("\n- ")}`);
  }
  if (vp.evaluation_heuristics?.length) {
    parts.push(`How they evaluate inbound:\n- ${vp.evaluation_heuristics.slice(0, 6).join("\n- ")}`);
  }
  if (vp.green_flags?.length) {
    parts.push(`Green flags:\n- ${vp.green_flags.slice(0, 5).join("\n- ")}`);
  }
  if (vp.red_flags?.length) {
    parts.push(`Red flags they often mention:\n- ${vp.red_flags.slice(0, 5).join("\n- ")}`);
  }
  if (vp.favorite_phrases?.length) {
    parts.push(`Phrases they use:\n- ${vp.favorite_phrases.slice(0, 5).join("\n- ")}`);
  }
  return parts.length ? parts.join("\n\n") : (profile?.bio?.trim() ?? "") || null;
}

const MIN_CORPUS_CHARS = 1000;

export async function buildVoiceProfileFromLinks(params: {
  urls: string[];
  provider?: LLMProvider;
  model?: string;
  manualText?: string;
  /** Max time to spend scraping links (default 5 minutes). */
  maxCrawlMs?: number;
}): Promise<RobinVoiceProfile | null> {
  const { urls, provider = "openai", model, manualText, maxCrawlMs = 5 * 60 * 1000 } = params;

  const { corpus } = await scrapeUrlsWithTimeBudget(urls, maxCrawlMs);

  if (!corpus && !manualText?.trim()) {
    return null;
  }

  const effectiveText = corpus.trim() || manualText?.trim() || "";
  if (effectiveText.length < MIN_CORPUS_CHARS && !manualText?.trim()) {
    // After up to 5 min of scraping, not enough content — ask for 30s description
    return null;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }

  const prompt = buildVoicePrompt(effectiveText, manualText);
  const { content } = await callLLMServer({
    provider,
    model,
    apiKey,
    messages: [{ role: "user", content: prompt }],
    jsonMode: true,
  });

  try {
    const parsed = JSON.parse(content) as RobinVoiceProfile;
    return parsed;
  } catch {
    return null;
  }
}

