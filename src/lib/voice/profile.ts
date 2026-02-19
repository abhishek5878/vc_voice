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
}

export interface RobinProfileRow {
  user_id: string;
  slug?: string | null;
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
  return `You are building a structured \"voice profile\" for a VC.

You will be given samples of their writing / public content.${extra}

From this, infer:
- Tone (few words)
- Evaluation heuristics (how they decide, what they look for, what they avoid)
- Favorite phrases or stylistic tics
- Red flags they often mention
- Green flags they highlight

Return ONLY valid JSON in this schema:
{
  "tone": "string",
  "evaluation_heuristics": ["string", "..."],
  "favorite_phrases": ["string", "..."],
  "red_flags": ["string", "..."],
  "green_flags": ["string", "..."]
}

Do not add any extra keys.

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
    (Array.isArray(o.favorite_phrases) && o.favorite_phrases.length > 0);
  return hasContent ? (vp as RobinVoiceProfile) : null;
}

/** Build a single text block for system prompts from profile row (voice_profile + bio). */
export function buildVoiceProfileText(profile: {
  voice_profile?: RobinVoiceProfile | null;
  bio?: string | null;
}): string | null {
  const vp = normalizeVoiceProfile(profile?.voice_profile);
  if (!vp) return (profile?.bio?.trim() ?? "") || null;
  const parts: string[] = [];
  if (vp.tone?.trim()) parts.push(`Tone: ${vp.tone.trim()}`);
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
    parts.push(`Typical phrases:\n- ${vp.favorite_phrases.slice(0, 4).join("\n- ")}`);
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

