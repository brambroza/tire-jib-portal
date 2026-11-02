import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase service role configuration");
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
    global: {
      // บังคับ bypass Next.js fetch data cache ทุก request
      fetch: (url, options = {}) =>
        fetch(url, { ...options, cache: "no-store" })
    }
  });
}
