import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let _client: SupabaseClient | null = null

if (url && key) {
  try {
    _client = createClient(url, key)
  } catch (e) {
    console.error("Supabase client init failed:", e)
  }
} else {
  console.warn("[Punjab Portal] Supabase env vars missing — running in offline/mock mode.\nAdd VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env")
}

export const supabase = _client
export const supabaseReady = _client !== null