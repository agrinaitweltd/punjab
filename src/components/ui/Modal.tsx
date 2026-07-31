import type { MouseEvent, ReactNode } from 'react'
import { useRef } from 'react'
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
  const mouseDownOnBackdrop = useRef(false)

  if (!open) return null

  // Only close on a genuine click on the backdrop itself — a click event
  // also fires when a text-selection drag (mousedown inside the modal,
  // mouseup outside it, e.g. while highlighting text) ends over the
  // backdrop, which would otherwise close the dialog mid-selection.
  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    mouseDownOnBackdrop.current = event.target === event.currentTarget
  }
  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (mouseDownOnBackdrop.current && event.target === event.currentTarget) onClose()
    mouseDownOnBackdrop.current = false
  }

  // Rendered via a portal straight into <body> — page content uses CSS
  // transforms for its enter animation, and any ancestor with a transform
  // creates a new containing block for position:fixed descendants. Without
  // the portal, the backdrop would size itself against that animated
  // ancestor instead of the real viewport, clipping short modals and
  // leaving a blank gap below them (worst on mobile, where the page is short).
  return createPortal(
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick}>
      <div className={"modal" + (wide ? " modal-wide" : "")} onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose}>
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
