import { createClient } from "@supabase/supabase-js";

export function createServerSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return { ok: false as const, message: "Supabase server credentials missing. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify environment variables." };
  }
  return { ok: true as const, client: createClient(url, serviceRoleKey, { auth: { persistSession: false } }) };
}

export function getSupabaseProjectHost(url = process.env.SUPABASE_URL) {
  if (!url) return null;
  try { return new URL(url).host; } catch { return null; }
}
