import type { ReactNode } from "react"
import type { DateGroup } from "../../lib/dateGrouping"

/** Renders SECTION → DATE → RECORDS (item 10): one collapsible card per
    date group, newest groups open by default so the page reads useful at a
    glance without every day being expanded. Used identically by Invoices,
    Files, Email Imports, Communications, Payments and Credit Notes so the
    "grouped by day" pattern looks and behaves the same everywhere. */
export function DateAccordion<T>({ groups, renderGroup, defaultOpenCount = 2, emptyMessage = "No records found." }: {
  groups: DateGroup<T>[]
  renderGroup: (group: DateGroup<T>) => ReactNode
  defaultOpenCount?: number
  emptyMessage?: string
}) {
  if (groups.length === 0) return <div className="empty-state">{emptyMessage}</div>
  return (
    <div className="date-accordion">
      {groups.map((group, index) => (
        <details key={group.label} className="date-accordion-section" open={index < defaultOpenCount}>
          <summary className="date-accordion-summary">
            <span>{group.label}</span>
            <span className="date-accordion-count">{group.items.length}</span>
          </summary>
          <div className="date-accordion-body">{renderGroup(group)}</div>
        </details>
      ))}
    </div>
  )
}
