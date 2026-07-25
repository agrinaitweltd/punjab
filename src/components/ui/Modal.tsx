import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

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

  // Rendered via a portal straight into <body> — page content uses CSS
  // transforms for its enter animation, and any ancestor with a transform
  // creates a new containing block for position:fixed descendants. Without
  // the portal, the backdrop would size itself against that animated
  // ancestor instead of the real viewport, clipping short modals and
  // leaving a blank gap below them (worst on mobile, where the page is short).
  return createPortal(
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
    </div>,
    document.body,
  )
}
