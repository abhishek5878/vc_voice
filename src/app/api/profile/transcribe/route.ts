/**
 * POST /api/profile/transcribe
 * Body: multipart form with "audio" file (wav, mp3, m4a, webm, etc.)
 * Returns: { text: string }
 * Uses server OPENAI_API_KEY and Whisper.
 */
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getUserIdFromRequest } from "@/lib/deals/db";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB (Whisper limit)

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  const token = request.headers.get("x-supabase-access-token")?.trim();
  if (!token || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Transcription is not configured (OPENAI_API_KEY)." },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form body" }, { status: 400 });
  }

  const file = formData.get("audio") ?? formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Send an audio file in the 'audio' or 'file' field." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "Audio file too large (max 25 MB)." },
      { status: 400 }
    );
  }

  try {
    const openai = new OpenAI({ apiKey });
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });
    const text = (transcription as { text?: string }).text?.trim() ?? "";
    return NextResponse.json({ text });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Transcription failed", detail: message },
      { status: 500 }
    );
  }
}
