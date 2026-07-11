export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "56px 32px", textAlign: "center",
    }}>
      <div style={{ 
        width: 48, height: 48, borderRadius: 12, background: "#f3f4f6",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 16, color: "#9ca3af"
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="9" y1="9" x2="15" y2="9"/>
          <line x1="9" y1="13" x2="15" y2="13"/>
          <line x1="9" y1="17" x2="12" y2="17"/>
        </svg>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 6 }}>{title}</div>
      {description && <div style={{ fontSize: 13.5, color: "#9ca3af", maxWidth: 320, lineHeight: 1.6 }}>{description}</div>}
    </div>
  )
}