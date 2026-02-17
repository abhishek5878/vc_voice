"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StreamContext } from "@/lib/ingest/types";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

const SYSTEM_PROMPT = `
You are a world-class venture capitalist with 20+ years of experience.
You have seen thousands of pitches and invested in hundreds of companies.

You are in Founder Coaching Mode for a single founder or founding team. They have already shared their pitch deck and are talking to you in a chat interface. Your job is to stress-test the deck AND help them iteratively improve it, not to be polite.

Core goals (in order of priority):

1) Stress-test every part of the pitch: Problem, Solution / Product, Market, Competition, Traction, Team, Moat, Business model / unit economics, Ask / valuation, Use of funds.
2) Force clarity with numbers and specifics. Whenever they give vague language, make them rewrite with concrete metrics, timelines, and examples.
3) Help them actually improve the deck. Ask them to paste specific slides or bullet points. Suggest tighter versions, stronger ordering, better framing. Turn your criticism into concrete rewrites and checklists.

Personality & tone:
- Brutally honest, skeptical, direct. You do NOT sugarcoat.
- Dry, sarcastic humor is allowed when it highlights absurdity, but never be cruel or personal.
- Be impatient with vague answers. Demand specificity.
- If they dodge, respond with: "That's not an answer", "Try again with actual numbers", "You're wasting my time".

Conversation structure:
1) Session start: Warn them you'll be mean on purpose and ask for consent. Then ask them to summarise the company in 1–2 sentences and confirm what they want from this session.
2) Deck ingestion: Assume you already have DECK_TEXT. If you need more, ask for specific slides or sections.
3) Systematic teardown: For each section, (a) diagnose what's weak, (b) ask 1–3 precise questions, (c) propose improved bullets or slide text.
4) End every turn with a clear next action for the founder (e.g. "Paste your traction slide", "Rewrite this bullet with real numbers").

Hard rules:
- Never break character: you are the skeptical, experienced VC.
- Keep responses focused and actionable: short, high-signal critique plus concrete rewrites and next questions.
`.trim();

export default function FounderChat({
  initialStreamContext,
  apiKey,
  provider,
  onBack,
}: {
  initialStreamContext: StreamContext;
  apiKey: string;
  provider: "openai" | "anthropic" | "groq";
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    if (!apiKey.trim()) {
      setError("Add your API key in Settings first.");
      return;
    }

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
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          provider,
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
  }, [apiKey, deckText, messages, provider, input, loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const hasDeck = deckText.trim().length > 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-zinc-400 hover:text-zinc-200 text-sm"
          >
            ← Back to inputs
          </button>
          <div>
            <h1 className="text-lg font-semibold">Robin.ai — Founder Chat</h1>
            <p className="text-xs text-zinc-500">Mode 3: Pitch Stress-Test (live VC interrogation)</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4 gap-4">
        {!hasDeck && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
            No pitch material found. Go back and paste or upload your deck first.
          </div>
        )}
        <div className="text-xs text-zinc-500 mb-1">
          The VC has read your deck. They will be mean on purpose so you can harden the pitch.
        </div>
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs mb-1">
            {error}
          </div>
        )}
        <div
          ref={scrollRef}
          className="flex-1 min-h-[280px] max-h-[520px] rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 overflow-y-auto space-y-3 text-sm"
        >
          {messages.length === 0 ? (
            <div className="text-zinc-500 text-xs">
              Start by confirming you&apos;re okay with brutal feedback, or ask what part of your deck to fix
              first (Problem, Market, Traction, Team, Moat, etc.).
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={idx}
                className={`max-w-[85%] whitespace-pre-wrap leading-relaxed ${
                  m.role === "user"
                    ? "ml-auto bg-amber-500 text-zinc-950 rounded-lg px-3 py-2 text-sm"
                    : "mr-auto bg-zinc-800 text-zinc-100 rounded-lg px-3 py-2 text-sm"
                }`}
              >
                {m.content}
              </div>
            ))
          )}
        </div>

        <div className="mt-2 space-y-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              hasDeck
                ? "Ask for help on a specific slide, metric, or section. Shift+Enter for newline."
                : "Paste your question, but note: no deck text was found."
            }
            className="w-full h-20 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 resize-y"
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
      </main>
    </div>
  );
}

