export type LLMProvider = "openai" | "anthropic" | "groq";

export const PROVIDER_MODELS: Record<
  LLMProvider,
  { default: string; fast: string }
> = {
  openai: { default: "gpt-4o", fast: "gpt-4o-mini" },
  anthropic: { default: "claude-sonnet-4-20250514", fast: "claude-3-5-haiku-20241022" },
  groq: { default: "llama-3.1-70b-versatile", fast: "mixtral-8x7b-32768" },
};

export interface LLMRequest {
  provider: LLMProvider;
  model?: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}
