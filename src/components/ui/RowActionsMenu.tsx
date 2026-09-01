import { useEffect, useRef, useState } from "react"
import { MoreHorizontal } from "lucide-react"

export type RowAction = { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }

/** A compact three-dot "more actions" menu (item 15) - keeps a table row to
    one primary button plus this single trigger instead of a row of five or
    six separate buttons. */
export function RowActionsMenu({ actions, label = "More actions" }: { actions: RowAction[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  if (actions.length === 0) return null

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-block" }}>
      <button type="button" className="btn btn-ghost btn-sm" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div role="menu" style={{
          position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 20, minWidth: 180,
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 24px rgba(15,23,42,0.12)", padding: 4,
        }}>
          {actions.map(action => (
            <button
              key={action.label} type="button" role="menuitem" disabled={action.disabled}
              onClick={() => { setOpen(false); action.onClick() }}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 7, border: "none",
                background: "transparent", fontSize: 13, color: action.danger ? "#b91c1c" : "#111827",
                cursor: action.disabled ? "default" : "pointer", opacity: action.disabled ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!action.disabled) e.currentTarget.style.background = "#f3f4f6" }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent" }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
