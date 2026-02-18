import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import { callLLMServer } from "@/lib/llm/callServer";
import type { LLMProvider } from "@/lib/llm/types";
import { crawlUrl } from "./firecrawl";

export interface RobinVoiceProfile {
  tone: string;
  evaluation_heuristics: string[];
  favorite_phrases: string[];
  red_flags: string[];
  green_flags: string[];
}

export interface RobinProfileRow {
  user_id: string;
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

export async function getRobinProfile(userId: string): Promise<RobinProfileRow | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("robin_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as RobinProfileRow | null) ?? null;
}

export async function upsertRobinProfile(
  userId: string,
  updates: Partial<Omit<RobinProfileRow, "user_id">>
): Promise<RobinProfileRow> {
  const supabase = await createServerSupabase();
  const payload = { user_id: userId, ...updates };
  const { data, error } = await supabase
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

export async function buildVoiceProfileFromLinks(params: {
  urls: string[];
  provider?: LLMProvider;
  model?: string;
  manualText?: string;
}): Promise<RobinVoiceProfile | null> {
  const { urls, provider = "openai", model, manualText } = params;
  const uniqueUrls = Array.from(new Set(urls.map((u) => u.trim()).filter(Boolean)));

  let corpus = "";
  for (const url of uniqueUrls) {
    try {
      const text = await crawlUrl(url);
      if (text) {
        corpus += `\n\n===== ${url} =====\n\n${text}`;
      }
    } catch {
      // Ignore individual URL failures; continue with others
    }
  }

  if (!corpus.trim() && !manualText?.trim()) {
    return null;
  }

  const effectiveText = corpus.trim() || manualText?.trim() || "";
  if (effectiveText.length < 1000 && !manualText?.trim()) {
    // Too little public content and no manual fallback provided
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

