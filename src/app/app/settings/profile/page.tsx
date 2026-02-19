"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseAccessToken } from "@/lib/deals/supabase-auth";
import type { RobinVoiceProfile } from "@/lib/voice/profile";

interface ProfileResponse {
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
  extra_urls: string[] | null;
  scrape_status?: string | null;
  scrape_error?: string | null;
  voice_profile?: RobinVoiceProfile | null;
}

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [manualText, setManualText] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getSupabaseAccessToken();
      if (!token) {
        setError("Sign in to configure your Robin profile.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/profile", {
          headers: { "x-supabase-access-token": token },
        });
        if (!res.ok) throw new Error("Failed to load profile");
        const json = (await res.json()) as ProfileResponse;
        if (!cancelled) {
          setProfile(json);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load profile");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (field: keyof ProfileResponse, value: string) => {
    if (!profile) return;
    setProfile({ ...profile, [field]: value });
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getSupabaseAccessToken();
      if (!token) throw new Error("Not signed in");
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-access-token": token,
        },
        body: JSON.stringify({
          slug: profile.slug,
          bio: profile.bio,
          tone: profile.tone,
          decision_style: profile.decision_style,
          twitter_url: profile.twitter_url,
          linkedin_url: profile.linkedin_url,
          substack_url: profile.substack_url,
          blog_url: profile.blog_url,
          podcast_url: profile.podcast_url,
          extra_urls: profile.extra_urls ?? [],
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to save profile");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const triggerIngest = async (withManual: boolean) => {
    setIngesting(true);
    setError(null);
    try {
      const token = await getSupabaseAccessToken();
      if (!token) throw new Error("Not signed in");
      const res = await fetch("/api/profile/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-access-token": token,
        },
        body: JSON.stringify({
          manualText: withManual ? manualText : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to build voice profile");
      }
      if (profile) {
        setProfile({
          ...profile,
          scrape_status: json.status,
          scrape_error: json.status === "insufficient_content" ? "insufficient_content" : null,
          voice_profile: json.voice_profile ?? profile.voice_profile,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to build voice profile");
    } finally {
      setIngesting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6 text-zinc-500 text-sm">
        Loading profile…
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6">
        <p className="text-red-400 text-sm">{error}</p>
        <Link href="/app" className="text-amber-400 text-sm mt-2 inline-block">
          ← Back
        </Link>
      </div>
    );
  }

  if (!profile) return null;

  const needsManual =
    profile.scrape_status === "error" && profile.scrape_error === "insufficient_content";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="sticky top-0 z-10 p-4 sm:p-6 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/app" className="text-zinc-400 hover:text-zinc-200 text-sm">
            ← Back to Robin
          </Link>
          <h1 className="text-lg font-semibold tracking-tight">Your Robin profile</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto w-full p-4 sm:p-6 space-y-8">
        {error && (
          <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-xs text-red-200">
            {error}
          </div>
        )}

        <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">Public pitch link</h2>
          <p className="text-xs text-zinc-500 mb-1">
            This becomes your shareable link for founders (e.g. on X / LinkedIn). Slug must be unique.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-zinc-500">
              {typeof window !== "undefined" ? `${window.location.origin}/pitch/` : ""}
            </span>
            <input
              value={profile.slug ?? ""}
              onChange={(e) => handleChange("slug", e.target.value.toLowerCase())}
              placeholder="your-name-or-firm"
              className="flex-1 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500/70"
            />
          </div>
          <p className="text-[11px] text-zinc-500">
            3–32 characters; lowercase letters, numbers, and dashes only.
          </p>
        </section>

        <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">How you evaluate inbound</h2>
          <p className="text-xs text-zinc-500 mb-1">
            Tell Robin how you think. This is used when your public content is thin or ambiguous.
          </p>
          <textarea
            value={profile.bio ?? ""}
            onChange={(e) => handleChange("bio", e.target.value)}
            rows={4}
            className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500/70"
            placeholder="Example: I look for repeat founders with clear GRUE metrics. I say no when..."
          />
        </section>

        <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">Social links</h2>
          <p className="text-xs text-zinc-500">
            Robin will crawl these links (via Firecrawl) to learn your tone and heuristics.
          </p>
          <div className="space-y-2 text-sm">
            <input
              value={profile.twitter_url ?? ""}
              onChange={(e) => handleChange("twitter_url", e.target.value)}
              placeholder="Twitter / X"
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500/70"
            />
            <input
              value={profile.linkedin_url ?? ""}
              onChange={(e) => handleChange("linkedin_url", e.target.value)}
              placeholder="LinkedIn"
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500/70"
            />
            <input
              value={profile.substack_url ?? ""}
              onChange={(e) => handleChange("substack_url", e.target.value)}
              placeholder="Substack / newsletter"
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500/70"
            />
            <input
              value={profile.blog_url ?? ""}
              onChange={(e) => handleChange("blog_url", e.target.value)}
              placeholder="Personal blog"
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500/70"
            />
            <input
              value={profile.podcast_url ?? ""}
              onChange={(e) => handleChange("podcast_url", e.target.value)}
              placeholder="Podcast / YouTube playlist"
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500/70"
            />
          </div>
        </section>

        <section className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">Build your Robin voice</h2>
          <p className="text-xs text-zinc-500 mb-2">
            We&apos;ll crawl your links and compress them into a voice profile. No extra API key needed.
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
            <button
              type="button"
              onClick={() => triggerIngest(false)}
              disabled={ingesting}
              className="px-3 py-1.5 rounded-lg bg-amber-500/90 text-xs text-zinc-950 font-medium hover:bg-amber-400 disabled:opacity-60"
            >
              {ingesting ? "Building…" : "Rebuild from links"}
            </button>
            {profile.scrape_status === "done" && (
              <span className="text-xs text-emerald-400">
                Voice updated from your public content.
              </span>
            )}
            {needsManual && (
              <span className="text-xs text-amber-400">
                We scraped for up to 5 min but need more. Describe your investment style in 30 seconds below.
              </span>
            )}
          </div>

          {needsManual && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-zinc-500">
                Type or speak for ~30 seconds about how you evaluate founders (what you look for, what you pass on).
              </p>
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                rows={4}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500/70"
                placeholder="Paste a transcript or type: e.g. I look for repeat founders with clear metrics..."
              />
              <button
                type="button"
                onClick={() => triggerIngest(true)}
                disabled={ingesting || !manualText.trim()}
                className="px-3 py-1.5 rounded-lg bg-amber-500/90 text-xs text-zinc-950 font-medium hover:bg-amber-400 disabled:opacity-60"
              >
                {ingesting ? "Building from your description…" : "Use this description"}
              </button>
            </div>
          )}
        </section>

        {profile.voice_profile && (
          <section className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2 text-xs">
            <h2 className="text-sm font-medium text-amber-400/90">Robin will speak like:</h2>
            <p className="text-zinc-200">
              <span className="text-zinc-500">Tone:</span> {profile.voice_profile.tone}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-zinc-500 mb-1">Heuristics</p>
                <ul className="list-disc list-inside space-y-0.5 text-zinc-200">
                  {(profile.voice_profile.evaluation_heuristics ?? []).slice(0, 4).map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-zinc-500 mb-1">Green flags</p>
                <ul className="list-disc list-inside space-y-0.5 text-zinc-200">
                  {(profile.voice_profile.green_flags ?? []).slice(0, 4).map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

