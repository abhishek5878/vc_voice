import { NextRequest, NextResponse } from "next/server";

const PASSCODE = process.env.ROBIN_PASSCODE ?? "42";
const COOKIE_NAME = "robin_passcode_verified";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(request: NextRequest) {
  let body: { passcode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const submitted = typeof body.passcode === "string" ? body.passcode.trim() : "";
  if (submitted !== PASSCODE) {
    return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
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
