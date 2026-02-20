import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

const PASSCODE = process.env.ROBIN_PASSCODE ?? "42";
const COOKIE_NAME = "robin_passcode_verified";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Ensure a Supabase user exists for this email with password = passcode, so client can sign in with email+passcode. */
async function ensureUserForEmail(supabase: ReturnType<typeof createAdminSupabase>, email: string, passcode: string) {
  // Service-role client exposes auth.admin (createUser, listUsers, updateUserById)
  const admin = (supabase.auth as unknown as { admin?: { listUsers: (p?: { perPage?: number }) => Promise<{ data: { users: { id: string; email?: string }[] } }>; createUser: (a: { email: string; password: string; email_confirm?: boolean }) => Promise<{ error: Error | null }>; updateUserById: (id: string, a: { password: string }) => Promise<{ error: Error | null }> } }).admin;
  if (!admin) throw new Error("Admin API not available");
  const { data: listData } = await admin.listUsers({ perPage: 1000 });
  const users = listData?.users ?? [];
  const existing = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    const { error } = await admin.updateUserById(existing.id, { password: passcode });
    if (error) throw error;
    return;
  }
  const { error } = await admin.createUser({ email, password: passcode, email_confirm: true });
  if (error) throw error;
}

export async function POST(request: NextRequest) {
  let body: { passcode?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const submitted = typeof body.passcode === "string" ? body.passcode.trim() : "";
  if (submitted !== PASSCODE) {
    return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json({ error: "Email is required so your account stays private." }, { status: 400 });
  }

  try {
    const supabase = createAdminSupabase();
    await ensureUserForEmail(supabase, email, submitted);
    try {
      await supabase.from("robin_emails").insert({ email });
    } catch {
      // Don't fail sign-in if storage fails
    }
  } catch (e) {
    console.error("Passcode ensureUserForEmail:", e);
    return NextResponse.json({ error: "Could not set up your account. Try again." }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
