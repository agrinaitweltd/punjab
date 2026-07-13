import { supabaseReady } from "../lib/supabase"

export function SyncStatus() {
  // Connected: show nothing — the badge was visual noise for clients.
  if (supabaseReady) return null
  // Only surface a warning when the portal is NOT connected to the database.
  return (
    <div style={{ position: "fixed", bottom: 12, right: 12, background: "#6b7280", color: "#fff", padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, zIndex: 9999 }}>
      ● Offline mode
    </div>
  )
}
