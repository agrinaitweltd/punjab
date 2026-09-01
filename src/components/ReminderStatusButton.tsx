import { useEffect, useState } from "react"
import type { Invoice } from "../types"
import { Button } from "./ui/Button"
import { reminderCooldownState, formatCooldownRemaining, formatNextReminderAt } from "../lib/reminderCooldown"

/** The one place "Send Reminder" is rendered (item 2) - either the active
    button, or, during the 24h server-enforced cooldown, a clear disabled
    state ("Reminder Sent" / "Available again in Xh Ym"). Used identically
    from InvoicesPage, OutstandingInvoicesPage and RemindersPage so the rule
    reads the same everywhere: reading straight off `invoice` means no extra
    prop-threading or query is needed in any of those pages. */
export function ReminderStatusButton({ invoice, onSend, size = 'sm' }: { invoice: Invoice; onSend: () => void; size?: 'sm' | 'md' }) {
  const [now, setNow] = useState(() => new Date())
  const { active, nextAllowedAt } = reminderCooldownState(invoice, now)

  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [active])

  if (!active || !nextAllowedAt) {
    return <Button className={size === 'sm' ? 'btn-sm' : undefined} onClick={onSend}>Send Reminder</Button>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
      <Button className={size === 'sm' ? 'btn-sm' : undefined} variant="secondary" disabled title={`Next reminder available ${formatNextReminderAt(nextAllowedAt)}`}>
        Reminder Sent
      </Button>
      <small style={{ fontSize: 10.5, color: '#9ca3af' }}>
        Available in {formatCooldownRemaining(nextAllowedAt, now)} · {formatNextReminderAt(nextAllowedAt)}
      </small>
    </div>
  )
}
