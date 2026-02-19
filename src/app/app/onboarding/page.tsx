"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ProfileResponse {
  user_id: string;
  slug?: string | null;
  bio: string | null;
  twitter_url: string | null;
  linkedin_url: string | null;
  substack_url: string | null;
  blog_url: string | null;
  podcast_url: string | null;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [slug, setSlug] = useState("");
  const [bio, setBio] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [substackUrl, setSubstackUrl] = useState("");
  const [blogUrl, setBlogUrl] = useState("");
  const [podcastUrl, setPodcastUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [liveLink, setLiveLink] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (res.status === 401) {
          if (!cancelled) router.replace("/auth");
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error("Failed to load profile");
        const json = (await res.json()) as ProfileResponse;
        if (cancelled) return;
        if (json.slug?.trim()) {
          setRedirecting(true);
          router.replace("/app");
          return;
        }
        setSlug(json.slug ?? "");
        setBio(json.bio ?? "");
        setTwitterUrl(json.twitter_url ?? "");
        setLinkedinUrl(json.linkedin_url ?? "");
        setSubstackUrl(json.substack_url ?? "");
        setBlogUrl(json.blog_url ?? "");
        setPodcastUrl(json.podcast_url ?? "");
      } catch {
        if (!cancelled) setError("Could not load profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedSlug = slug.trim().toLowerCase();
    if (!trimmedSlug) {
      setError("Choose a URL slug for your pitch link (e.g. your-name).");
      return;
    }
    if (!/^[a-z0-9-]{3,32}$/.test(trimmedSlug)) {
      setError("Slug must be 3–32 characters: only lowercase letters, numbers, and dashes.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: trimmedSlug,
          bio: bio.trim() || null,
          twitter_url: twitterUrl.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          substack_url: substackUrl.trim() || null,
          blog_url: blogUrl.trim() || null,
          podcast_url: podcastUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile");
      setBuilding(true);
      const ingestRes = await fetch("/api/profile/ingest", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualText: bio.trim() || undefined }),
      });
      await ingestRes.json();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setLiveLink(`${origin}/pitch/${trimmedSlug}`);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
      setBuilding(false);
    }
  };

  if (loading || redirecting) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">
        {redirecting ? "Taking you to Robin…" : "Loading…"}
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6">
            <span className="text-2xl text-emerald-400">✓</span>
          </div>
          <h1 className="text-xl font-semibold text-zinc-100 mb-2">Your pitch link is live</h1>
          <p className="text-sm text-zinc-400 mb-6">
            Share this link with founders. They’ll stress-test their pitch in your voice and can submit to your pipeline.
          </p>
          <div className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-700 mb-2">
            <a
              href={liveLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 text-sm break-all"
            >
              {liveLink}
            </a>
          </div>
          <p className="text-xs text-zinc-500 mb-8">You can copy this link from Settings anytime.</p>
          <Link
            href="/app"
            className="w-full sm:w-auto inline-flex justify-center px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold text-sm"
          >
            Go to Robin
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800/80 bg-zinc-950/95 p-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-semibold tracking-tight">Set up your Robin</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Add your pitch link and social links so Robin can speak in your voice.
          </p>
        </div>
      </header>
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-sm text-red-200">
              {error}
            </div>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-zinc-300">Your pitch link</h2>
            <p className="text-xs text-zinc-500">
              Founders will use this URL to pitch you. Choose a unique slug (e.g. your name or firm).
            </p>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 text-sm whitespace-nowrap">
                {typeof window !== "undefined" ? `${window.location.origin}/pitch/` : "/pitch/"}
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="your-name"
                className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70"
                required
              />
            </div>
            <p className="text-[11px] text-zinc-500">3–32 characters; lowercase letters, numbers, and dashes only.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-zinc-300">Social links</h2>
            <p className="text-xs text-zinc-500">
              Robin will use your public writing to learn your tone and how you evaluate founders. Add at least one.
            </p>
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="LinkedIn profile URL"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70"
            />
            <input
              type="url"
              value={twitterUrl}
              onChange={(e) => setTwitterUrl(e.target.value)}
              placeholder="Twitter / X profile URL"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70"
            />
            <input
              type="url"
              value={substackUrl}
              onChange={(e) => setSubstackUrl(e.target.value)}
              placeholder="Substack or newsletter URL"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70"
            />
            <input
              type="url"
              value={blogUrl}
              onChange={(e) => setBlogUrl(e.target.value)}
              placeholder="Personal blog or firm blog URL"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70"
            />
            <input
              type="url"
              value={podcastUrl}
              onChange={(e) => setPodcastUrl(e.target.value)}
              placeholder="Podcast or YouTube playlist URL"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70"
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-zinc-300">How you evaluate inbound (optional)</h2>
            <p className="text-xs text-zinc-500">
              A short description helps Robin when your links don’t give enough signal.
            </p>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="e.g. I look for repeat founders with clear metrics. I pass when..."
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/70 resize-y"
            />
          </section>

          <button
            type="submit"
            disabled={saving || building}
            className="w-full px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold text-sm disabled:opacity-60"
          >
            {building ? "Building your voice…" : saving ? "Saving…" : "Save & turn on my pitch link"}
          </button>
        </form>
      </main>
    </div>
  );
}
