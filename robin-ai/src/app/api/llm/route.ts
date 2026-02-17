/**
 * BYOK LLM proxy. Key in Authorization header. Backend never stores or logs it.
 * POST /api/llm — body: { provider, model?, messages, stream? }
 */
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { PROVIDER_MODELS, type LLMProvider, type LLMRequest } from "@/lib/llm/types";

const MIN_INPUT = 200;
const MAX_INPUT_PER_STREAM = 50_000;

function getApiKey(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

function estimateChars(messages: { content: string }[]): number {
  return messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
}

export async function POST(request: NextRequest) {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Your API key appears to be invalid or expired. Update it in Settings." },
      { status: 401 }
    );
  }

  let body: LLMRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { provider, model, messages, stream = false } = body;
  if (!provider || !messages?.length) {
    return NextResponse.json(
      { error: "Missing provider or messages" },
      { status: 400 }
    );
  }

  const totalChars = estimateChars(messages);
  if (totalChars < MIN_INPUT) {
    return NextResponse.json(
      { error: "Input too short for meaningful analysis. Paste your full transcript or pitch narrative." },
      { status: 400 }
    );
  }
  if (totalChars > MAX_INPUT_PER_STREAM * 2) {
    return NextResponse.json(
      { error: "Input exceeds maximum length." },
      { status: 400 }
    );
  }

  const resolvedModel = model || PROVIDER_MODELS[provider as LLMProvider]?.default || "gpt-4o";

  try {
    if (provider === "openai") {
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: resolvedModel,
        messages: messages.map((m) => ({
          role: m.role as "system" | "user" | "assistant",
          content: m.content,
        })),
        stream,
        response_format: !stream ? { type: "json_object" as const } : undefined,
      });

      if (stream) {
        const streamResult = completion as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
        return new Response(
          new ReadableStream({
            async start(controller) {
              for await (const chunk of streamResult) {
                const delta = chunk.choices?.[0]?.delta?.content;
                if (delta) controller.enqueue(new TextEncoder().encode(delta));
              }
              controller.close();
            },
          }),
          { headers: { "Content-Type": "text/plain; charset=utf-8" } }
        );
      }

      const c = (completion as OpenAI.Chat.Completions.ChatCompletion).choices?.[0]?.message;
      const content = c?.content ?? "";
      return NextResponse.json({
        content,
        usage: (completion as OpenAI.Chat.Completions.ChatCompletion).usage
          ? {
              prompt_tokens: (completion as OpenAI.Chat.Completions.ChatCompletion).usage!.prompt_tokens,
              completion_tokens: (completion as OpenAI.Chat.Completions.ChatCompletion).usage!.completion_tokens,
            }
          : undefined,
      });
    }

    if (provider === "anthropic") {
      const anthropic = new Anthropic({ apiKey });
      const system = messages.find((m) => m.role === "system")?.content ?? "";
      const rest = messages.filter((m) => m.role !== "system");

      const response = await anthropic.messages.create({
        model: resolvedModel,
        max_tokens: 8192,
        system,
        messages: rest.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      });

      const textBlock = response.content.find((b) => b.type === "text");
      const content = textBlock && "text" in textBlock ? textBlock.text : "";
      return NextResponse.json({
        content,
        usage: response.usage
          ? {
              prompt_tokens: response.usage.input_tokens,
              completion_tokens: response.usage.output_tokens,
            }
          : undefined,
      });
    }

    if (provider === "groq") {
      // Groq uses OpenAI-compatible API
      const openai = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
      const completion = await openai.chat.completions.create({
        model: resolvedModel,
        messages: messages.map((m) => ({
          role: m.role as "system" | "user" | "assistant",
          content: m.content,
        })),
        stream: false,
        response_format: { type: "json_object" as const },
      });
      const c = completion.choices?.[0]?.message;
      return NextResponse.json({
        content: c?.content ?? "",
        usage: completion.usage
          ? { prompt_tokens: completion.usage.prompt_tokens, completion_tokens: completion.usage.completion_tokens }
          : undefined,
      });
    }

    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("401") || message.includes("Incorrect API key")) {
      return NextResponse.json(
        { error: "Your API key appears to be invalid or expired. Update it in Settings." },
        { status: 401 }
      );
    }
    if (message.includes("429") || message.includes("rate limit")) {
      return NextResponse.json(
        { error: "Rate limit hit on your API key. Wait 60 seconds and retry." },
        { status: 429 }
      );
    }
    if (message.includes("quota") || message.includes("insufficient")) {
      return NextResponse.json(
        { error: "Your API account appears to have insufficient credits. Top up and retry." },
        { status: 402 }
      );
    }
    return NextResponse.json(
      { error: "LLM request failed", detail: message },
      { status: 502 }
    );
  }
}
