/**
 * POST /api/pitch/send-to-investor
 * Body: { slug, messages: { role, content }[], companyName? }
 * Returns: { pointers, at_par, vc_email?, emailSubject?, emailBody? } in the VC's voice.
 * When at_par and VC has email, founder can email profile + evidence to the VC.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { buildVoiceProfileText } from "@/lib/voice/profile";
import { callLLMServer } from "@/lib/llm/callServer";

interface SendToInvestorBody {
  slug?: string;
  messages?: { role: string; content: string }[];
  companyName?: string;
}

interface SendToInvestorResult {
  at_par: boolean;
  pointers: string;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server OPENAI_API_KEY is not configured." },
      { status: 500 }
    );
  }

  let body: SendToInvestorBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.toLowerCase().trim() : "";
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() || "Unknown" : "Unknown";

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }
  if (messages.length < 2) {
    return NextResponse.json(
      { error: "Need at least a short conversation to generate pointers." },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();
  const { data: profile, error: profileError } = await admin
    .from("robin_profiles")
    .select("user_id, bio, voice_profile, email")
    .eq("slug", slug)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Pitch link not found." }, { status: 404 });
  }

  const voiceProfileText = buildVoiceProfileText(profile);
  const conversationText = messages
    .map((m) => `${m.role === "user" ? "Founder" : "VC"}: ${(m.content || "").trim()}`)
    .join("\n\n");

  const systemPrompt = `You are the investor (VC) whose voice and criteria are described below. A founder just had a stress-test conversation with your AI. Your job is to:
1) Decide if the founder is "at par" — ready to send their pitch to you (clarity, numbers, no major gaps). Reply with at_par: true or false.
2) Give 3–5 short, actionable pointers in YOUR voice for the founder to work on. Be direct and specific. These apply whether they are at par or not (everyone can sharpen).

Voice and how you evaluate:
${voiceProfileText || "You are a direct, no-nonsense VC. You care about clarity, numbers, and differentiation."}

Return ONLY valid JSON in this exact shape (no markdown, no extra keys):
{"at_par": boolean, "pointers": "Bullet 1.\\nBullet 2.\\nBullet 3."}
Use \\n for newlines inside the pointers string.`;

  const userPrompt = `Company: ${companyName}\n\nConversation:\n${conversationText.slice(-12000)}`;

  try {
    const { content } = await callLLMServer({
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      jsonMode: true,
    });

    let result: SendToInvestorResult;
    try {
      result = JSON.parse(content) as SendToInvestorResult;
    } catch {
      return NextResponse.json(
        { error: "Invalid response from assistant." },
        { status: 500 }
      );
    }

    const atPar = Boolean(result.at_par);
    const pointers = typeof result.pointers === "string" ? result.pointers.trim() : "";

    const vcEmail = atPar && profile.email?.trim() ? profile.email.trim() : undefined;
    const emailSubject = vcEmail
      ? `Pitch: ${companyName} (via Robin stress-test)`
      : undefined;
    const summarySnippet = conversationText.slice(-1500).split("\n\n").slice(-6).join("\n\n");
    const emailBody = vcEmail
      ? [
          `Company: ${companyName}`,
          "",
          "From my Robin stress-test:",
          summarySnippet || "—",
          "",
          "Points I'm working on:",
          pointers || "—",
        ].join("\n").slice(0, 4000)
      : undefined;

    return NextResponse.json({
      pointers: pointers || "No specific pointers.",
      at_par: atPar,
      vc_email: vcEmail,
      emailSubject,
      emailBody,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Failed to generate pointers.", detail: message },
      { status: 500 }
    );
  }
}
