/** Groups a list of records into Today / Yesterday / <date> / Older buckets
    by local calendar day (item 11) - purely a client-side, in-memory
    grouping of whatever rows the caller already loaded. No database
    changes, no separate copies of the data. */
export type DateGroup<T> = { label: string; items: T[] }

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

function labelFor(iso: string, today: number): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Undated'
  const diffDays = Math.round((today - dayStart(date)) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays > 1 && diffDays <= 6) return date.toLocaleDateString('en-GB', { weekday: 'long' })
  if (diffDays > 6) return 'Older'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Groups items newest-first by their date (via getDate), each into a
    Today/Yesterday/<weekday>/<date>/Older bucket, buckets in that same
    newest-first order. Pass sortDirection: 'asc' to flip both the bucket
    order and the items within each bucket. */
export function groupByDate<T>(items: T[], getDate: (item: T) => string, sortDirection: 'desc' | 'asc' = 'desc'): DateGroup<T>[] {
  const today = dayStart(new Date())
  const sorted = [...items].sort((a, b) => {
    const cmp = getDate(a).localeCompare(getDate(b))
    return sortDirection === 'desc' ? -cmp : cmp
  })
  const groups: DateGroup<T>[] = []
  const indexByLabel = new Map<string, number>()
  for (const item of sorted) {
    const label = labelFor(getDate(item), today)
    let index = indexByLabel.get(label)
    if (index === undefined) { index = groups.length; groups.push({ label, items: [] }); indexByLabel.set(label, index) }
    groups[index].items.push(item)
  }
  return groups
}
