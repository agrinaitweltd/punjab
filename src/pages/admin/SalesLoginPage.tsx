import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Button } from "../../components/ui/Button"
import { verifySalesLogin, SALESMEN } from "../../lib/salesmen"
import { getSalesmen } from "../../api/miscApi"
import type { Salesman } from "../../types"

export function SalesLoginPage({ onLogin }: { onLogin: (salesman: Salesman) => void }) {
  const [number, setNumber] = useState("")
  const [username, setUsername] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [roster, setRoster] = useState<Salesman[]>(SALESMEN)

  useEffect(() => { getSalesmen().then(setRoster).catch(() => setRoster(SALESMEN)) }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const salesman = verifySalesLogin(number, username, code, roster)
    if (!salesman) { setError("Sales number, username or code is incorrect."); return }
    setError("")
    onLogin(salesman)
  }

  return (
    <div className="stack" style={{ maxWidth: 380, margin: "60px auto" }}>
      <div style={{ textAlign: "center" }}>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Sales Login</h2>
        <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
          Enter your sales number, username and code to access the Sales module.
        </p>
      </div>
      <form onSubmit={submit} className="ps-table-card" style={{ padding: 24 }}>
        <label className="form-control">
          <span>Number</span>
          <input type="text" inputMode="numeric" placeholder="e.g. 1" value={number} onChange={e => setNumber(e.target.value)} autoFocus required />
        </label>
        <label className="form-control">
          <span>Username</span>
          <input type="text" placeholder="e.g. mohsen" value={username} onChange={e => setUsername(e.target.value)} required />
        </label>
        <label className="form-control">
          <span>Code</span>
          <input type="password" placeholder="4-digit code" value={code} onChange={e => setCode(e.target.value)} required />
        </label>
        {error && <p style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", margin: "0 0 12px" }}>{error}</p>}
        <Button type="submit" style={{ width: "100%" }}>Log In to Sales</Button>
      </form>
    </div>
  )
}
