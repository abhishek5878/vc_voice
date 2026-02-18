"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StreamContext } from "@/lib/ingest/types";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

const SYSTEM_PROMPT = `
You are a world-class venture capitalist with 20+ years of experience. You are the VC who says what their friends won't: short answers, real numbers, no fluff. Think Hemingway brevity, Wilde wit, and dry sarcasm when it exposes vagueness—never cruel, always sharp.

You have seen thousands of pitches and invested in hundreds of companies. You are in Founder Coaching Mode. They have shared their pitch deck; your job is to stress-test it and help them improve it, not to be polite.

Core goals (in order of priority):

1) Stress-test every part of the pitch: Problem, Solution / Product, Market, Competition, Traction, Team, Moat, Business model / unit economics, Ask / valuation, Use of funds.
2) Force clarity with numbers and specifics. Vague language gets one chance, then: "That's not an answer.", "Try again with actual numbers.", "You're wasting my time."
3) Help them actually improve the deck. Ask for specific slides or bullets. Give concrete rewrites and checklists. End every turn with a clear next action.

Personality & tone:
- Brutally honest, skeptical, direct. No sugarcoating.
- Dry, sarcastic humor when it highlights absurdity; never personal.
- Impatient with fluff. Demand specificity and differentiation.

Conversation structure:
1) Session start: Brief warning that you're mean on purpose. Ask them to summarise the company in 1–2 sentences and what they want from this session.
2) Deck: You have DECK_TEXT. If you need more, ask for specific slides or sections.
3) Systematic teardown: For each section—diagnose what's weak, ask 1–3 precise questions, propose improved copy. End with a next action.

Hard rules:
- Never break character. Keep responses short, high-signal, and actionable.
`.trim();

const VIBE_CHECK_SYSTEM = `
You are summarizing a founder pitch stress-test chat for a VC partner. Output exactly 3 short bullets, no intro or outro:
1) Vibe: one line on how the founder came across (e.g. prepared vs defensive, numbers vs fluff).
2) Strengths: one line on what was strongest (e.g. clarity on TAM, crisp unit economics).
3) Concerns: one line on what to probe (e.g. competition hand-waved, traction unverified).
Keep each bullet under 100 characters. Plain text only, no markdown.
`.trim();

const ACTION_ITEMS_SYSTEM = `
You are summarizing a founder pitch stress-test conversation into 3 concrete action items for the founder. Output exactly 3 bullets, no intro or outro. Each line should be a clear next step they can do (e.g. "Clarify burn rate with a number and runway date", "Add a slide on retention cohorts", "Rewrite the problem statement in one sentence"). Plain text only, no markdown. Number them 1. 2. 3.
`.trim();

export default function FounderChat({
  initialStreamContext,
  onBack,
  onToast,
}: {
  initialStreamContext: StreamContext;
  onBack: () => void;
  onToast?: (message: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [vibeCheckLoading, setVibeCheckLoading] = useState(false);
  const [actionItemsLoading, setActionItemsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const deckText =
    initialStreamContext.PITCH_MATERIAL ||
    initialStreamContext.PUBLIC_TRANSCRIPT ||
    initialStreamContext.PRIVATE_DICTATION ||
    "";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Seed an initial assistant message once when we have deck text.
  useEffect(() => {
    if (!deckText.trim()) return;
    if (messages.length > 0) return;
    setMessages([
      {
        role: "assistant",
        content:
          "I’ve read your deck. I’m the VC who says what your friends won't—short answers, real numbers, no fluff. I'll be blunt on purpose so we can harden this pitch. " +
          "In one or two sentences: what are you building, and what do you want from this session (e.g. fix the seed deck, get ready for a partner meeting.)",
      },
    ]);
  }, [deckText, messages.length]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setError(null);
    setLoading(true);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");

    try {
      const systemWithDeck =
        SYSTEM_PROMPT +
        "\n\nDECK_TEXT (pitch deck content):\n" +
        deckText.slice(0, 20000);

      const res = await fetch("/api/llm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "openai",
          messages: [
            { role: "system", content: systemWithDeck },
            ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
          ],
          stream: false,
        }),
      });

      const raw = await res.text();
      let data: { content?: string; error?: string; detail?: string };
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(res.ok ? "Invalid response from LLM" : `Server error (${res.status})`);
      }

      if (!res.ok) {
        throw new Error(data.detail || data.error || `Chat failed (${res.status})`);
      }

      const reply = (data.content ?? "").trim();
      if (!reply) {
        throw new Error("Empty response from LLM");
      }

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setLoading(false);
    }
  }, [deckText, messages, input, loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const copyForPartner = useCallback(async () => {
    if (messages.length < 2 || vibeCheckLoading) return;
    setError(null);
    setVibeCheckLoading(true);
    try {
      const conversation = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "openai",
          messages: [
            { role: "system", content: VIBE_CHECK_SYSTEM },
            ...conversation,
          ],
          stream: false,
        }),
      });
      const raw = await res.text();
      let data: { content?: string; error?: string; detail?: string };
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(res.ok ? "Invalid response" : `Failed (${res.status})`);
      }
      if (!res.ok) throw new Error(data.detail || data.error || `Failed (${res.status})`);
      const summary = (data.content ?? "").trim();
      if (!summary) throw new Error("Empty summary");
      await navigator.clipboard.writeText(summary);
      onToast?.("Vibe check copied to clipboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vibe check failed");
    } finally {
      setVibeCheckLoading(false);
    }
  }, [messages, vibeCheckLoading, onToast]);

  const copyActionItems = useCallback(async () => {
    if (messages.length < 2 || actionItemsLoading) return;
    setError(null);
    setActionItemsLoading(true);
    try {
      const conversation = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "openai",
          messages: [
            { role: "system", content: ACTION_ITEMS_SYSTEM },
            ...conversation,
          ],
          stream: false,
        }),
      });
      const raw = await res.text();
      let data: { content?: string; error?: string; detail?: string };
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(res.ok ? "Invalid response" : `Failed (${res.status})`);
      }
      if (!res.ok) throw new Error(data.detail || data.error || `Failed (${res.status})`);
      const summary = (data.content ?? "").trim();
      if (!summary) throw new Error("Empty action items");
      await navigator.clipboard.writeText(summary);
      onToast?.("3 action items copied to clipboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action items failed");
    } finally {
      setActionItemsLoading(false);
    }
  }, [messages, actionItemsLoading, onToast]);

  const hasDeck = deckText.trim().length > 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="sticky top-0 z-10 p-4 sm:p-6 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
          >
            ← Back to inputs
          </button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Robin.ai — Founder Chat</h1>
            <p className="text-xs text-zinc-500">Mode 3: Pitch Stress-Test (live VC interrogation)</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const url = `${typeof window !== "undefined" ? window.location.origin : ""}/app?mode=3`;
              void navigator.clipboard.writeText(url);
            }}
            className="text-xs text-amber-500/90 hover:text-amber-400"
          >
            Copy link for another founder
          </button>
          {messages.length >= 2 && (
            <>
              <button
                type="button"
                onClick={() => void copyActionItems()}
                disabled={actionItemsLoading}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs border border-amber-500/40 disabled:opacity-50"
                title="Your 3 action items from this session"
              >
                {actionItemsLoading ? "Generating…" : "Copy your 3 action items"}
              </button>
              <button
                type="button"
                onClick={() => void copyForPartner()}
                disabled={vibeCheckLoading}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs border border-zinc-700/50 disabled:opacity-50"
                title="3-bullet vibe check for your partner"
              >
                {vibeCheckLoading ? "Generating…" : "Copy for my Partner"}
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full p-4 sm:p-6 gap-4">
        {!hasDeck && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
            No pitch material found. Go back and paste or upload your deck first.
          </div>
        )}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs mb-1">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)] gap-4 flex-1">
          <section className="hidden lg:flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-xs text-zinc-400 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">Deck snapshot</p>
                <p className="text-[11px] text-zinc-500">
                  {deckText.length.toLocaleString()} chars ·{" "}
                  {Math.max(1, Math.round(deckText.length / 800))} slide-equivalents (rough)
                </p>
              </div>
            </div>
            <div className="flex-1 rounded-md bg-zinc-950/60 border border-zinc-800/70 p-2 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {deckText ? deckText.slice(0, 3000) : "No deck text available."}
              {deckText.length > 3000 && (
                <span className="block mt-2 text-[10px] text-zinc-600">
                  …truncated. The VC still sees the full deck in context.
                </span>
              )}
            </div>
          </section>

          <section className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/30">
            <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
              <div className="text-[11px] text-zinc-500">
                The VC has your deck loaded. Expect blunt questions and concrete rewrites.
              </div>
              <span className="hidden sm:inline text-[11px] text-zinc-600">
                Press Enter to send · Shift+Enter for newline
              </span>
            </div>
            <div
              ref={scrollRef}
              className="flex-1 min-h-[260px] max-h-[520px] p-3 overflow-y-auto space-y-3 text-sm"
            >
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[85%] space-y-1">
                    <div
                      className={`text-[10px] font-medium tracking-wide ${
                        m.role === "user" ? "text-amber-400 text-right" : "text-zinc-500"
                      }`}
                    >
                      {m.role === "user" ? "You" : "VC"}
                    </div>
                    <div
                      className={`whitespace-pre-wrap leading-relaxed ${
                        m.role === "user"
                          ? "ml-auto bg-amber-500 text-zinc-950 rounded-lg px-3 py-2 text-sm"
                          : "mr-auto bg-zinc-800 text-zinc-100 rounded-lg px-3 py-2 text-sm"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="text-zinc-500 text-xs">
                  Start by confirming you&apos;re okay with brutal feedback, or ask what part of your deck to
                  fix first (Problem, Market, Traction, Team, Moat, etc.).
                </div>
              )}
            </div>
            <div className="border-t border-zinc-800 px-3 py-2 space-y-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  hasDeck
                    ? "Ask for help on a specific slide, metric, or section. Shift+Enter for newline."
                    : "Paste your question, but note: no deck text was found."
                }
                className="w-full h-20 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 resize-y"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  Provider: <span className="text-zinc-300">{provider}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={loading || !input.trim()}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:pointer-events-none text-sm font-medium text-zinc-950"
                >
                  {loading ? "Thinking…" : "Send"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

