import { useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { runtimeTable } from './runtimeMode'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawRow = Record<string, any>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TableSync<T = any> = {
  /** Raw snake_case DB row -> camelCase client type (reuse databaseService's map* functions). */
  map: (row: RawRow) => T
  onInsert?: (row: T) => void
  onUpdate?: (row: T) => void
  onDelete?: (id: string) => void
}

/** Opens one Supabase Realtime channel per table and routes INSERT/UPDATE/DELETE
 *  to the caller's merge callbacks - never refetches, only patches the one
 *  affected row. Call this ONCE for the whole admin session (e.g. in
 *  AdminPortal.tsx), not per-page, so there is exactly one subscription per
 *  table regardless of how many pages are mounted.
 *
 *  Requires the table to actually be added to the `supabase_realtime`
 *  publication (see sql/migrations/020_realtime_publication.sql) - RLS on
 *  these tables already grants every active admin SELECT on every row, so
 *  once a table is in the publication every admin session receives every
 *  change to it with no further policy work needed. */
export function useRealtimeSync(tables: Record<string, TableSync>) {
  // Handlers are read through a ref so the effect below doesn't need to
  // re-subscribe every time a parent re-render passes new closures - only
  // the actual table list identity matters for (re)subscribing.
  const tablesRef = useRef(tables)
  tablesRef.current = tables
  const tableNames = Object.keys(tables).sort().join(',')

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    const channels = Object.keys(tablesRef.current).map(table => {
      const dbTable = runtimeTable(table)
      return client
        .channel(`sync:${dbTable}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: dbTable },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => {
            const sync = tablesRef.current[table]
            if (!sync) return
            if (payload.eventType === 'INSERT') sync.onInsert?.(sync.map(payload.new))
            else if (payload.eventType === 'UPDATE') sync.onUpdate?.(sync.map(payload.new))
            else if (payload.eventType === 'DELETE' && payload.old?.id) sync.onDelete?.(payload.old.id)
          },
        )
        .subscribe()
    })
    return () => { for (const channel of channels) client.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableNames])
}
