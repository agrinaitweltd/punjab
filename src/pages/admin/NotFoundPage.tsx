import { Button } from "../../components/ui/Button"

export function NotFoundPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <div className="stack" style={{ textAlign: "center", padding: "64px 24px" }}>
      <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
      <h2 style={{ fontSize: 40, fontWeight: 800, color: "#0d2b1e", margin: "8px 0" }}>404</h2>
      <p style={{ fontSize: 15, color: "#6b7a70", marginBottom: 20 }}>
        That page doesn't exist or you don't have access to it.
      </p>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Button onClick={() => onNavigate("dashboard")}>Back to Dashboard</Button>
      </div>
    </div>
  )
}
