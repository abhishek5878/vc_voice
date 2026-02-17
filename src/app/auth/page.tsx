"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

type Mode = "login" | "register";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const trimmedEmail = email.trim();
      if (!trimmedEmail || !password) {
        setError("Enter your email and password.");
        return;
      }

      setLoading(true);
      try {
        const supabase = createBrowserSupabase();

        if (mode === "login") {
          const { data, error: err } = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });
          if (err) {
            setError(err.message || "Login failed.");
            return;
          }
          if (!data.session) {
            setError("Login failed. No active session returned.");
            return;
          }
        } else {
          const displayName = (name || "My Workspace").trim();
          const { data, error: err } = await supabase.auth.signUp({
            email: trimmedEmail,
            password,
            options: {
              data: { name: displayName },
            },
          });
          if (err) {
            setError(err.message || "Sign up failed.");
            return;
          }
          if (!data.session) {
            // Email-confirmation flows can return null session. Still redirect to app with a notice.
            // For now, just continue; Supabase will handle email confirmation if configured.
          }
        }

        router.push("/app");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unexpected error.");
      } finally {
        setLoading(false);
      }
    },
    [mode, email, password, name, router]
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="auth-page w-full max-w-sm border border-zinc-800 bg-zinc-900/60 rounded-xl p-5 shadow-lg shadow-black/40">
          <h1 className="text-xl font-semibold mb-1">Robin.ai</h1>
          <p className="text-xs text-zinc-500 mb-4">Your calendar, filtered.</p>

          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`flex-1 px-3 py-2 rounded-md text-sm border ${
                mode === "login"
                  ? "bg-amber-600 border-amber-500 text-zinc-950"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`flex-1 px-3 py-2 rounded-md text-sm border ${
                mode === "register"
                  ? "bg-amber-600 border-amber-500 text-zinc-950"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <div className="space-y-1">
                <label className="block text-xs text-zinc-400" htmlFor="name">
                  Name (optional)
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                  placeholder="My Workspace"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs text-zinc-400" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                placeholder="you@company.com"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-zinc-400" htmlFor="password">
                Password {mode === "register" && <span className="text-zinc-500">(min 6)</span>}
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={mode === "register" ? 6 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-1 px-3 py-2.5 rounded-md bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-sm font-medium text-zinc-950"
            >
              {loading ? (mode === "login" ? "Logging in…" : "Signing up…") : mode === "login" ? "Log in" : "Sign up"}
            </button>
          </form>

          <p className="mt-4 text-[11px] text-zinc-500">
            Back to{" "}
            <button
              type="button"
              onClick={() => router.push("/")}
              className="underline underline-offset-2 decoration-zinc-600 hover:text-zinc-300"
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

