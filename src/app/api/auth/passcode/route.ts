import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

const PASSCODE = process.env.ROBIN_PASSCODE ?? "420000";
const COOKIE_NAME = "robin_passcode_verified";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Supabase requires password length >= 6. Normalize passcode so server and client use the same value. */
function toPassword(passcode: string): string {
  return passcode.length >= 6 ? passcode : passcode.padEnd(6, "0");
}

function getAuthAdminConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) throw new Error("Missing Supabase URL or service role key");
  return {
    baseUrl: `${url.replace(/\/$/, "")}/auth/v1`,
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
  };
}

/** Ensure a Supabase user exists for this email with password = normalized passcode (min 6 chars for Supabase). */
async function ensureUserForEmail(_supabase: ReturnType<typeof createAdminSupabase>, email: string, passcode: string) {
  const password = toPassword(passcode);
  const { baseUrl, headers } = getAuthAdminConfig();

  // List users and find by email (paginate if needed)
  let existing: { id: string } | null = null;
  let page = 1;
  const perPage = 1000;
  while (true) {
    const listRes = await fetch(`${baseUrl}/admin/users?page=${page}&per_page=${perPage}`, { headers });
    if (!listRes.ok) {
      const errText = await listRes.text();
      throw new Error(`listUsers failed: ${listRes.status} ${errText}`);
    }
    const listJson = (await listRes.json()) as { users?: { id: string; email?: string }[] };
    const users = listJson?.users ?? [];
    const found = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) {
      existing = { id: found.id };
      break;
    }
    if (users.length < perPage) break;
    page += 1;
  }

  const now = new Date().toISOString();
  if (existing) {
    const updateRes = await fetch(`${baseUrl}/admin/users/${existing.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ password, email_confirm: true, email_confirmed_at: now }),
    });
    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error(`updateUser failed: ${updateRes.status} ${errText}`);
    }
    return;
  }

  const createRes = await fetch(`${baseUrl}/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password, email_confirm: true, email_confirmed_at: now }),
  });
  if (!createRes.ok) {
    const errBody = await createRes.text();
    // If user already exists (e.g. created between list and create), update password
    const alreadyExists =
      createRes.status === 422 ||
      /already registered|already exists|duplicate/i.test(errBody);
    if (alreadyExists) {
      // Retry list once and update
      const retryList = await fetch(`${baseUrl}/admin/users?page=1&per_page=1000`, { headers });
      if (retryList.ok) {
        const retryJson = (await retryList.json()) as { users?: { id: string; email?: string }[] };
        const user = retryJson?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (user) {
          const updateRes2 = await fetch(`${baseUrl}/admin/users/${user.id}`, {
            method: "PUT",
            headers,
            body: JSON.stringify({ password, email_confirm: true, email_confirmed_at: new Date().toISOString() }),
          });
          if (updateRes2.ok) return;
        }
      }
    }
    throw new Error(`createUser failed: ${createRes.status} ${errBody}`);
  }
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
    const message = e instanceof Error ? e.message : String(e);
    console.error("Passcode ensureUserForEmail:", message);
    return NextResponse.json(
      { error: "Could not set up your account. Try again." },
      { status: 500 }
    );
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
