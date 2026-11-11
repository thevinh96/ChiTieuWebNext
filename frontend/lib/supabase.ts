import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && publishableKey);

let client: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (!url || !publishableKey) throw new Error("Thiếu cấu hình Supabase ở frontend.");
  if (!client) client = createClient(url, publishableKey);
  return client;
}
