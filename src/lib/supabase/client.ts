import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserSupabase: SupabaseClient | null = null;

/** Single Supabase client instance in the browser so session is shared (e.g. after signInAnonymously). */
export function createBrowserSupabase(): SupabaseClient {
  if (browserSupabase) return browserSupabase;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  browserSupabase = createClient(supabaseUrl, supabaseAnonKey);
  return browserSupabase;
}
