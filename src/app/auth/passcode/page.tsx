"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function PasscodePage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled) {
        setCheckingSession(false);
        if (!session) {
          router.replace("/auth");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = passcode.trim();
    if (!trimmed) {
      setError("Enter the passcode.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/passcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Incorrect passcode.");
        setLoading(false);
        return;
      }
      router.push("/app/onboarding");
    } catch {
      setError("Something went wrong.");
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col hero-mesh">
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm border border-zinc-800 bg-zinc-900/50 rounded-2xl p-6 sm:p-8 shadow-xl shadow-black/30">
          <h1 className="text-xl font-semibold tracking-tight mb-1">Robin passcode</h1>
          <p className="text-xs text-zinc-500 mb-6">
            Enter the passcode to continue.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs text-zinc-400" htmlFor="passcode">
                Passcode
              </label>
              <input
                id="passcode"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20"
                placeholder="Enter passcode"
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 mt-1"
            >
              {loading ? "Verifying…" : "Continue"}
            </button>
          </form>

          <p className="mt-6 text-[11px] text-zinc-500">
            <button
              type="button"
              onClick={() => router.push("/auth")}
              className="underline underline-offset-2 decoration-zinc-600 hover:text-zinc-300 transition-colors"
            >
              ← Back to sign in
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
