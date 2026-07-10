import { supabaseReady } from "../lib/supabase"

export function SyncStatus() {
  if (supabaseReady) {
    return (
      <div style={{ position: "fixed", bottom: 12, right: 12, background: "#059669", color: "#fff", padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, zIndex: 9999 }}>
        ● Live sync ON
      </div>
    )
  }
  return (
    <div style={{ position: "fixed", bottom: 12, right: 12, background: "#6b7280", color: "#fff", padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, zIndex: 9999 }}>
      ● Offline mode
    </div>
  )
}
