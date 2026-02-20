"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedPasscode = passcode.trim();
      const trimmedEmail = email.trim();
      if (!trimmedPasscode) {
        setError("Enter the passcode.");
        return;
      }
      if (!trimmedEmail) {
        setError("Enter your email so your account stays private.");
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const res = await fetch("/api/auth/passcode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode: trimmedPasscode, email: trimmedEmail }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Incorrect passcode.");
          setLoading(false);
          return;
        }
        const supabase = createBrowserSupabase();
        await supabase.auth.signOut();
        // Supabase requires password length >= 6; same normalization as passcode API
        const password = trimmedPasscode.length >= 6 ? trimmedPasscode : trimmedPasscode.padEnd(6, "0");
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (signInError) {
          setError(signInError.message || "Could not sign in.");
          setLoading(false);
          return;
        }
        window.location.assign("/app/onboarding");
      } catch {
        setError("Something went wrong.");
        setLoading(false);
      }
    },
    [passcode, email]
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col hero-mesh">
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm border border-zinc-800 bg-zinc-900/50 rounded-2xl p-6 sm:p-8 shadow-xl shadow-black/30">
          <h1 className="text-xl font-semibold tracking-tight mb-1">PitchRobin</h1>
          <p className="text-xs text-zinc-500 mb-6">Your investment bar, automated.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs text-zinc-400" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                placeholder="you@example.com"
              />
            </div>
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
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                placeholder="Enter passcode"
              />
            </div>

            {error && (
            <div className="text-xs text-red-400" role="alert" aria-live="assertive" aria-atomic="true">
              <p>{error}</p>
              <button type="button" onClick={() => setError(null)} className="mt-1 text-cyan-400 hover:text-cyan-300">Dismiss</button>
              <span className="text-zinc-500 mx-1">·</span>
              <button type="button" onClick={() => router.push("/")} className="text-cyan-400 hover:text-cyan-300">Back to home</button>
            </div>
          )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 mt-1"
            >
              {loading ? "Verifying…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-[11px] text-zinc-500">
            Back to{" "}
            <button
              type="button"
              onClick={() => router.push("/")}
              className="underline underline-offset-2 decoration-zinc-600 hover:text-zinc-300 transition-colors"
            >
              home
            </button>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
