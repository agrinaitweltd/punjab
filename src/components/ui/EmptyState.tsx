export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "56px 32px", textAlign: "center",
    }}>
      <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.35 }}>{icon ?? "📋"}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 6 }}>{title}</div>
      {description && <div style={{ fontSize: 13.5, color: "#9ca3af", maxWidth: 320, lineHeight: 1.6 }}>{description}</div>}
    </div>
  )
}