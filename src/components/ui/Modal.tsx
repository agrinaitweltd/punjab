import type { ReactNode } from 'react'

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={"modal" + (wide ? " modal-wide" : "")} onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  )
}
