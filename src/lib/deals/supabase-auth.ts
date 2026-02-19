"use client";

import { createBrowserSupabase } from "@/lib/supabase/client";

/** Get current Supabase access token for API calls. Tries refresh once if no session (e.g. expired). */
export async function getSupabaseAccessToken(): Promise<string | null> {
  const supabase = createBrowserSupabase();
  let { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    session = refreshed ?? null;
  }
  return session?.access_token ?? null;
}
