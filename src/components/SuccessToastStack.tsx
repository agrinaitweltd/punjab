import { useEffect, useState } from 'react'

type SuccessToast = { id: string; message: string }

function Toast({ toast, onDismiss }: { toast: SuccessToast; onDismiss: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 4000)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="success-toast" role="status">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
      <span>{toast.message}</span>
    </div>
  )
}

export function SuccessToastStack() {
  const [toasts, setToasts] = useState<SuccessToast[]>([])
  useEffect(() => {
    const onSuccess = (event: Event) => {
      const message = (event as CustomEvent<string>).detail
      setToasts(list => [...list, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, message }])
    }
    window.addEventListener('app-success', onSuccess)
    return () => window.removeEventListener('app-success', onSuccess)
  }, [])
  if (!toasts.length) return null
  return (
    <div className="success-toast-stack">
      {toasts.map(toast => <Toast key={toast.id} toast={toast} onDismiss={() => setToasts(list => list.filter(t => t.id !== toast.id))} />)}
    </div>
  )
}
