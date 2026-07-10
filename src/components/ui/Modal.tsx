import type { ReactNode } from 'react'
import { Button } from './Button'

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <h3>{title}</h3>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </header>
        {children}
      </div>
    </div>
  )
}

