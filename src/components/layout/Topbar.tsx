import type { User } from '../../types'
import { Button } from '../ui/Button'

export function Topbar({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="brand-icon" style={{ width: 30, height: 30, fontSize: 10, background: 'linear-gradient(135deg, #22913f, #1a5c2d)', color: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>PEF</div>
        <h1>Punjab Exotic Foods Ltd</h1>
      </div>
      <div className="topbar-actions">
        <span className="topbar-user">{user.displayName}</span>
        <Button variant="secondary" className="btn-sm" onClick={onLogout}>
          Sign Out
        </Button>
      </div>
    </header>
  )
}
