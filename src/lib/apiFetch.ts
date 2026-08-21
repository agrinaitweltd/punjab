import { supabase } from './supabase'

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const sessionResult = await supabase?.auth.getSession()
  const headers = new Headers(init.headers)
  const token = sessionResult?.data.session?.access_token
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}
