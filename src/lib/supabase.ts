import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !key) {
  console.warn("Supabase env vars not set — check .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)")
}

export const supabase = createClient(url ?? "", key ?? "")