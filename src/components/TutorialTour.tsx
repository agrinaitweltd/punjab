import { useEffect, useState } from 'react'
import type { PermissionSet, User } from '../types'
import { markTutorialSeen } from '../lib/secureAdminApi'

type TourStep = { key: string; navigateTo: string; title: string; body: string; requires?: keyof PermissionSet }

/** Mirrors the sections a real admin actually has (see Sidebar.tsx's
    adminNavigation/NAV_PERMISSION_KEY) - each step switches the dashboard to
    the real, live page it describes rather than showing a floating popup
    with nothing behind it. The overlay below blocks clicks on that live
    page for the duration of the tour, so nothing gets created, sent or
    changed by walking through it. */
const TOUR_STEPS: TourStep[] = [
  { key: 'welcome', navigateTo: 'dashboard', title: 'Welcome to Punjab Exotic Foods', body: "Let's quickly show you around the sections you can use — this only takes a minute, and you can skip it any time." },
  { key: 'dashboard', navigateTo: 'dashboard', title: 'Dashboard', body: 'Your daily overview: recent activity and anything that needs attention today.' },
  { key: 'customers', navigateTo: 'customers', title: 'Customers', body: 'Search for a customer, open their account, and see their balance and invoices.' },
  { key: 'invoices', navigateTo: 'invoices', requires: 'invoicesView', title: 'Invoices', body: "The full invoice list — paid and unpaid — with the original and generated PDFs and each invoice's reminder status." },
  { key: 'reminders', navigateTo: 'reminders-due-today', requires: 'invoicesSendReminders', title: 'Payment Reminders', body: '14-day, 21-day, and 21+ days overdue reminders, organised by when they fall due.' },
  { key: 'payments', navigateTo: 'payments', requires: 'payments', title: 'Payments', body: 'View and record payments against customer invoices, and see running balances.' },
  { key: 'email-imports', navigateTo: 'email-imports', requires: 'emailImportsView', title: 'Email Imports', body: 'Invoices, statements and credit notes that arrived by email, ready for review.' },
  { key: 'files', navigateTo: 'files', requires: 'filesView', title: 'Files & Documents', body: 'Every original and generated PDF — invoices, statements and credit notes — all in one place.' },
  { key: 'communications', navigateTo: 'communication-history', requires: 'communicationsView', title: 'Communications', body: 'A record of every reminder and email sent, with the full message available to view.' },
  { key: 'notifications', navigateTo: 'notifications', title: 'Notifications', body: 'Important system activity and anything that needs your attention.' },
  { key: 'finish', navigateTo: 'dashboard', title: "You're ready to go", body: "That's the tour — you can watch it again any time from Settings." },
]

export function TutorialTour({ open, user, onNavigate, onClose }: {
  open: boolean
  user: User
  /** Switches the dashboard's visible page - the same navigate() AdminPortal
      already uses for its own sidebar. */
  onNavigate: (key: string) => void
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const steps = TOUR_STEPS.filter(s => !s.requires || user.isSuperAdmin || Boolean(user.permissions?.[s.requires]))

  useEffect(() => { if (open) setIndex(0) }, [open])

  useEffect(() => {
    if (!open) return
    const step = steps[index]
    if (step) onNavigate(step.navigateTo)
    // Only the current index should re-trigger navigation - re-running this
    // whenever `steps`/`onNavigate` are recreated would fight the user's own
    // clicks elsewhere while the tour is closed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index])

  if (!open || steps.length === 0) return null
  const step = steps[index]
  const isLast = index === steps.length - 1

  const end = () => { markTutorialSeen().catch(() => { /* replays from Settings regardless */ }); onClose() }

  return (
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-label="Guided tour">
      <div className="tour-card">
        <div className="tour-card-head">
          <span className="tour-step-label">Step {index + 1} of {steps.length}</span>
          <button type="button" className="tour-skip" onClick={end}>Skip Tutorial</button>
        </div>
        <h3 className="tour-title">{step.title}</h3>
        <p className="tour-body">{step.body}</p>
        <div className="tour-dots">
          {steps.map((s, i) => <span key={s.key} className={"tour-dot" + (i === index ? " active" : "")} />)}
        </div>
        <div className="tour-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIndex(i => Math.max(0, i - 1))} disabled={index === 0}>Back</button>
          {isLast
            ? <button type="button" className="btn btn-sm" onClick={end}>Finish Tutorial</button>
            : <button type="button" className="btn btn-sm" onClick={() => setIndex(i => i + 1)}>Next</button>}
        </div>
      </div>
    </div>
  )
}
