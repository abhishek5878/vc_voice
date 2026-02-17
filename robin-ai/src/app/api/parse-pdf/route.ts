/**
 * POST /api/parse-pdf
 * Body: { images: string[] } — each string is data URL (data:image/jpeg;base64,...) or raw base64
 * Uses OpenAI vision (gpt-4o) to extract text. Key from env: OPENAI_API_KEY.
 */
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const MAX_IMAGES = 20;
const PROMPT =
  "Extract all text from these document or slide images in order. Return only the extracted text, preserving order and structure. Do not add commentary or headings.";

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server missing OPENAI_API_KEY. Set it in your environment." },
      { status: 503 }
    );
  }

  let body: { images?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawImages = body.images ?? [];
  if (rawImages.length === 0) {
    return NextResponse.json({ error: "No images provided" }, { status: 400 });
  }

  const images = rawImages.slice(0, MAX_IMAGES).map((img) => {
    if (img.startsWith("data:")) return img;
    return `data:image/jpeg;base64,${img}`;
  });

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: PROMPT },
    ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content }],
      max_tokens: 4096,
    });
    const text = completion.choices?.[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ text });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("401") || message.includes("Incorrect API key")) {
      return NextResponse.json(
        { error: "Invalid OpenAI API key. Check Settings." },
        { status: 401 }
      );
    }
    if (message.includes("429")) {
      return NextResponse.json(
        { error: "Rate limit hit. Wait a moment and try again." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: "PDF parsing failed", detail: message.slice(0, 200) },
      { status: 502 }
    );
  }
}
