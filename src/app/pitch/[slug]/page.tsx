import { notFound } from "next/navigation";
import type { Metadata } from "next";
import FounderChat from "@/components/FounderChat";
import type { StreamContext } from "@/lib/ingest/types";
import { createAdminSupabase } from "@/lib/supabase/admin";

interface PageProps {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = params.slug;
  return {
    title: `Pitch – ${slug} | Robin.ai`,
  };
}

async function getProfileBySlug(slug: string) {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("robin_profiles")
    .select("user_id, bio, tone, decision_style, twitter_url, linkedin_url, substack_url, blog_url, podcast_url, extra_urls, voice_profile")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as {
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
    voice_profile: {
      tone: string;
      evaluation_heuristics: string[];
      favorite_phrases: string[];
      red_flags: string[];
      green_flags: string[];
    } | null;
  };
}

function buildVoiceProfileText(profile: Awaited<ReturnType<typeof getProfileBySlug>>): string | null {
  if (!profile?.voice_profile) return profile?.bio ?? null;
  const vp = profile.voice_profile;
  const parts: string[] = [];
  if (vp.tone) parts.push(`Tone: ${vp.tone}`);
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
  return parts.join("\n\n");
}

export default async function PitchPage({ params }: PageProps) {
  const rawSlug = params.slug?.toLowerCase().trim() ?? "";
  if (!rawSlug) notFound();
  const profile = await getProfileBySlug(rawSlug);
  if (!profile) notFound();

  const voiceProfileText = buildVoiceProfileText(profile);

  const initialStreamContext: StreamContext = {};

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="w-full border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs text-amber-400/90 uppercase tracking-[0.2em] mb-1">Pitch to my Robin</p>
            <h1 className="text-xl font-semibold tracking-tight">
              {profile.bio ? profile.bio.slice(0, 80) : "VC pitch portal"}
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Before we meet, my AI associate Robin will stress-test your pitch against my specific heuristics.
            </p>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-4 sm:py-6">
        <section className="mb-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <h2 className="text-sm font-medium text-zinc-300 mb-2">How I evaluate inbound</h2>
          <p className="text-xs text-zinc-400 whitespace-pre-wrap">
            {voiceProfileText ??
              "Paste your deck or narrative below. Robin will probe like I do in first meetings."}
          </p>
        </section>
        <FounderChat
          initialStreamContext={initialStreamContext}
          onBack={() => {
            /* no-op on public page */
          }}
          onToast={undefined}
        />
      </main>
    </div>
  );
}

