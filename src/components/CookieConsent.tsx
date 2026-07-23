import { useEffect, useState } from "react"

const STORAGE_KEY = "punjab-cookie-consent"

type Prefs = { necessary: true; performance: boolean; targeting: boolean; functionality: boolean }

const CATEGORIES: { key: keyof Prefs; label: string; locked?: boolean; detail: string }[] = [
  { key: "necessary",     label: "Strictly necessary", locked: true, detail: "Required for login sessions and core site features. Always on." },
  { key: "performance",   label: "Performance",   detail: "Helps us understand how the portal is used so we can improve it." },
  { key: "targeting",     label: "Targeting",     detail: "Used to show relevant produce offers and promotions." },
  { key: "functionality", label: "Functionality", detail: "Remembers preferences like your saved views and filters." },
]

export function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [prefs, setPrefs] = useState<Prefs>({ necessary: true, performance: false, targeting: false, functionality: false })

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch { /* storage unavailable — stay hidden */ }
  }, [])

  const save = (p: Prefs) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...p, savedAt: new Date().toISOString() })) } catch { /* ignore */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="ck-card" role="dialog" aria-label="Cookie consent">
      <button className="ck-close" aria-label="Close" onClick={() => save(prefs)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <h3 className="ck-title">This website uses cookies</h3>
      <p className="ck-copy">
        We use cookies to personalise content and to analyse our traffic. We also share
        information about your use of our site with our analytics partners who may combine
        it with other information that you've provided to them. <a href="/privacy" className="ck-link" target="_blank" rel="noopener">Privacy Policy</a>
      </p>

      <div className="ck-options">
        {CATEGORIES.map(c => {
          const checked = prefs[c.key] === true
          return (
            <div key={c.key}>
              <label className={"ck-option" + (c.locked ? " ck-locked" : "")}>
                <span className={"ck-box" + (checked ? " on" : "") + (c.locked ? " locked" : "")}>
                  {checked && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4"><polyline points="20 6 9 17 4 12"/></svg>}
                </span>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={c.locked}
                  onChange={e => !c.locked && setPrefs(p => ({ ...p, [c.key]: e.target.checked }))}
                  style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
                />
                {c.label}
              </label>
              {showDetails && <p className="ck-detail">{c.detail}</p>}
            </div>
          )
        })}
      </div>

      <div className="ck-btn-row">
        <button className="ck-btn" onClick={() => save({ necessary: true, performance: true, targeting: true, functionality: true })}>Accept all</button>
        <button className="ck-btn" onClick={() => save({ necessary: true, performance: false, targeting: false, functionality: false })}>Decline all</button>
      </div>

      <button className="ck-details-btn" onClick={() => setShowDetails(v => !v)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        {showDetails ? "Hide details" : "Show details"}
      </button>
    </div>
  )
}
