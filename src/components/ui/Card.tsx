import type { ReactNode } from 'react'

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="card-header">
          {title ? <h3>{title}</h3> : <span />}
          {actions}
        </header>
      )}
      <div>{children}</div>
    </section>
  )
}

