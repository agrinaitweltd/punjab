import type { ReactNode } from 'react'

export function DataTable({
  columns,
  children,
}: {
  columns: string[]
  children: ReactNode
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

