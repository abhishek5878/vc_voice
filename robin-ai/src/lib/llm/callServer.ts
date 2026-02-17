/**
 * Server-side LLM calls for the pipeline. Uses API key from request context.
 * Never logged or stored.
 */
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { PROVIDER_MODELS, type LLMProvider } from "./types";

export interface ServerLLMOptions {
  provider: LLMProvider;
  model?: string;
  apiKey: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  jsonMode?: boolean;
}

export async function callLLMServer(options: ServerLLMOptions): Promise<{ content: string; usage?: { prompt_tokens: number; completion_tokens: number } }> {
  const { provider, apiKey, messages, jsonMode = true } = options;
  const model = options.model || PROVIDER_MODELS[provider]?.default || "gpt-4o";

  if (provider === "openai") {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      response_format: jsonMode ? { type: "json_object" } : undefined,
    });
    const content = completion.choices?.[0]?.message?.content ?? "";
    return {
      content,
      usage: completion.usage
        ? { prompt_tokens: completion.usage.prompt_tokens, completion_tokens: completion.usage.completion_tokens }
        : undefined,
    };
  }

  if (provider === "anthropic") {
    const anthropic = new Anthropic({ apiKey });
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const rest = messages.filter((m) => m.role !== "system");
    const response = await anthropic.messages.create({
      model,
      max_tokens: 8192,
      system: jsonMode ? `${system}\n\nReturn ONLY valid JSON with no markdown or explanation.` : system,
      messages: rest.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    });
    const textBlock = response.content.find((b) => b.type === "text");
    const content = textBlock && "text" in textBlock ? textBlock.text : "";
    return {
      content,
      usage: response.usage
        ? { prompt_tokens: response.usage.input_tokens, completion_tokens: response.usage.output_tokens }
        : undefined,
    };
  }

  if (provider === "groq") {
    const openai = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
    const completion = await openai.chat.completions.create({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      response_format: jsonMode ? { type: "json_object" } : undefined,
    });
    const content = completion.choices?.[0]?.message?.content ?? "";
    return {
      content,
      usage: completion.usage
        ? { prompt_tokens: completion.usage.prompt_tokens, completion_tokens: completion.usage.completion_tokens }
        : undefined,
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
