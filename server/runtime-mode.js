import { createClient } from '@supabase/supabase-js'

export function serviceClient() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server-side Supabase is not configured')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function globalTestMode(client) {
  const admin = client || serviceClient()
  const { data, error } = await admin.from('system_settings').select('test_mode').eq('id', true).maybeSingle()
  if (error) throw error
  return Boolean(data?.test_mode)
}

export const simulatedResult = channel => ({
  ok: true,
  sent: true,
  simulated: true,
  message: `TEST MODE - ${channel} simulated successfully. Nothing was sent.`,
})
