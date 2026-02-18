"use client";

import { createBrowserSupabase } from "@/lib/supabase/client";

export async function getSupabaseAccessToken(): Promise<string | null> {
  const supabase = createBrowserSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
