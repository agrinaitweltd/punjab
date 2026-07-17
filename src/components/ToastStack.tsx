import { useEffect } from "react"
import type { Toast } from "../lib/notifications"

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 7000)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="ntf-toast" role="status">
      <span className="ntf-toast-ico">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      </span>
      <div className="ntf-toast-body">
        <strong>{toast.title}</strong>
        <p>{toast.body}</p>
      </div>
      <button className="ntf-toast-x" onClick={onDismiss} aria-label="Dismiss">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  )
}

export function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="ntf-toast-stack">
      {toasts.map(t => <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />)}
    </div>
  )
}
