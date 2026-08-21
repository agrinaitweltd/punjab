import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { runtimeTable } from './runtimeMode'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let _client: SupabaseClient | null = null

if (url && key) {
  try {
    const client = createClient(url, key)
    _client = new Proxy(client, {
      get(target, property, receiver) {
        if (property === 'from') return (table: string) => target.from(runtimeTable(table))
        const value = Reflect.get(target, property, receiver)
        return typeof value === 'function' ? value.bind(target) : value
      },
    }) as SupabaseClient
  } catch (e) {
    console.error("Supabase client init failed:", e)
  }
} else {
  console.warn("[Punjab Portal] Supabase env vars missing — running in offline/mock mode.\nAdd VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env")
}

export const supabase = _client
export const supabaseReady = _client !== null
