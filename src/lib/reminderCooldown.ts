import type { Invoice } from '../types'

const COOLDOWN_MS = 24 * 60 * 60 * 1000

export type ReminderCooldown = { active: boolean; nextAllowedAt: Date | null }

/** Reads the 24h reminder cooldown straight off the invoice record - the
    server (reserve_invoice_reminder_slot, see sql/migrations/032) is the
    only thing that ever sets lastReminderSentAt, so this is purely a
    display calculation, never the enforcement itself (item 2: the real gate
    is server-side). */
export function reminderCooldownState(invoice: Invoice, now: Date = new Date()): ReminderCooldown {
  if (!invoice.lastReminderSentAt) return { active: false, nextAllowedAt: null }
  const sentAt = new Date(invoice.lastReminderSentAt)
  if (Number.isNaN(sentAt.getTime())) return { active: false, nextAllowedAt: null }
  const nextAllowedAt = new Date(sentAt.getTime() + COOLDOWN_MS)
  return { active: nextAllowedAt > now, nextAllowedAt }
}

/** "18h 24m" style countdown for the disabled button's helper text. */
export function formatCooldownRemaining(nextAllowedAt: Date, now: Date = new Date()): string {
  const remainingMs = Math.max(0, nextAllowedAt.getTime() - now.getTime())
  const totalMinutes = Math.ceil(remainingMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

/** "2 Sep, 14:30" style absolute time for the "Next reminder:" line. */
export function formatNextReminderAt(nextAllowedAt: Date): string {
  return nextAllowedAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
