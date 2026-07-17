import { useEffect, useRef, useState } from "react"

export type Toast = { id: string; title: string; body: string }

function loadSeen(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) ?? "[]")) } catch { return new Set() }
}
function saveSeen(key: string, ids: Set<string>) {
  try { localStorage.setItem(key, JSON.stringify([...ids])) } catch { /* ignore */ }
}

/** Tracks which of `items` (by id) have been "seen" (opened) by this user on
 *  this device — powers a badge count that clears once the section is viewed. */
export function useUnseenCount<T extends { id: string }>(items: T[], storageKey: string) {
  const [seen, setSeen] = useState<Set<string>>(() => loadSeen(storageKey))
  const unseenCount = items.filter(i => !seen.has(i.id)).length
  const markAllSeen = () => {
    const next = new Set(items.map(i => i.id))
    setSeen(next)
    saveSeen(storageKey, next)
  }
  return { unseenCount, markAllSeen }
}

/** Fires a toast whenever `detect` finds something new or changed between
 *  polls of `items` — e.g. a brand-new order, or a status transition.
 *  Skips the very first snapshot so mounting never floods old data as "new". */
export function useLiveToasts<T extends { id: string }>(
  items: T[],
  detect: (prevById: Map<string, T>, curr: T) => Toast | null,
): { toasts: Toast[]; dismiss: (id: string) => void } {
  const [toasts, setToasts] = useState<Toast[]>([])
  const prevRef = useRef<Map<string, T> | null>(null)

  useEffect(() => {
    const prev = prevRef.current
    if (prev) {
      const fresh: Toast[] = []
      for (const item of items) {
        const t = detect(prev, item)
        if (t) fresh.push(t)
      }
      if (fresh.length) setToasts(ts => [...fresh, ...ts].slice(0, 4))
    }
    prevRef.current = new Map(items.map(i => [i.id, i]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const dismiss = (id: string) => setToasts(ts => ts.filter(t => t.id !== id))
  return { toasts, dismiss }
}

/** Polls `fn` on an interval so notifications keep working while a user is
 *  active on the page, not just when they navigate between sections. */
export function usePoll(fn: () => void, intervalMs: number) {
  useEffect(() => {
    const id = setInterval(fn, intervalMs)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, intervalMs])
}
