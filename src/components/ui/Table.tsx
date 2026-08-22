import { Children, isValidElement, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'

function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join(' ')
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children)
  return ''
}

function cellText(row: ReactNode, index: number): string {
  if (!isValidElement<{ children?: ReactNode }>(row)) return ''
  return nodeText(Children.toArray(row.props.children)[index]).trim()
}

export function DataTable({ columns, children }: { columns: string[]; children: ReactNode }) {
  const [query, setQuery] = useState('')
  const [sortColumn, setSortColumn] = useState<number | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const rows = useMemo(() => Children.toArray(children), [children])
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const selected = needle ? rows.filter(row => nodeText(row).toLowerCase().includes(needle)) : rows
    if (sortColumn === null) return selected
    return [...selected].sort((left, right) => {
      const comparison = cellText(left, sortColumn).localeCompare(cellText(right, sortColumn), 'en-GB', { numeric: true, sensitivity: 'base' })
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [query, rows, sortColumn, sortDirection])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visibleRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => setPage(1), [query, pageSize])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])

  const sort = (index: number) => {
    if (sortColumn === index) setSortDirection(value => value === 'asc' ? 'desc' : 'asc')
    else { setSortColumn(index); setSortDirection('asc') }
  }

  return <div className="data-table-shell">
    <div className="data-table-toolbar">
      <label className="data-table-search">
        <Search size={16} strokeWidth={1.8} aria-hidden="true" />
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search this table" aria-label="Search table" />
      </label>
      <span className="data-table-count">{filtered.length} {filtered.length === 1 ? 'record' : 'records'}</span>
    </div>
    <div className="table-wrap">
      <table>
        <thead><tr>{columns.map((column, index) => <th key={column}><button type="button" className={sortColumn === index ? 'table-sort active' : 'table-sort'} onClick={() => sort(index)}>{column}<span aria-hidden="true">{sortColumn === index ? sortDirection === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} /> : <ArrowUpDown size={11} />}</span></button></th>)}</tr></thead>
        <tbody>{visibleRows.length ? visibleRows : <tr><td className="data-table-empty" colSpan={columns.length}>No matching records</td></tr>}</tbody>
      </table>
    </div>
    <div className="data-table-footer">
      <label>Rows per page<select value={pageSize} onChange={event => setPageSize(Number(event.target.value))}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label>
      <span>Page {page} of {pageCount}</span>
      <div><button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={15} /></button><button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage(value => value + 1)}><ChevronRight size={15} /></button></div>
    </div>
  </div>
}

