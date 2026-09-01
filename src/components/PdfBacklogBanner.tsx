import { useEffect, useState } from 'react'
import { Button } from './ui/Button'
import { getPdfBacklogReport, repairPdfBacklogBatch } from '../lib/secureAdminApi'
import { showAppError } from '../lib/appDialogs'

/** Surfaces the generated-PDF backlog (items 2/3/14) to any authorised
    admin viewing Invoices - not just System Developer (item 12) - with a
    one-click repair that processes it in safe batches so a large backlog
    can't time out a single request (item 3). Silently does nothing when
    there's no backlog, so this is invisible on a healthy day. */
export function PdfBacklogBanner({ onRepaired }: { onRepaired?: () => void }) {
  const [needingRepair, setNeedingRepair] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ regenerated: 0, stillFailed: 0 })
  const [done, setDone] = useState(false)

  useEffect(() => {
    getPdfBacklogReport().then(r => setNeedingRepair(r.needingRepair)).catch(() => setNeedingRepair(null))
  }, [])

  const runRepair = async () => {
    setRunning(true)
    setDone(false)
    let regenerated = 0, stillFailed = 0, remaining = needingRepair ?? 0
    try {
      // Loop batches client-side rather than one huge request, so a
      // multi-hundred-invoice backlog never risks a single serverless
      // function timeout - matches item 3's "process safely in batches".
      do {
        const result = await repairPdfBacklogBatch(20)
        regenerated += result.regenerated
        stillFailed += result.stillFailed
        remaining = result.remaining
        setProgress({ regenerated, stillFailed })
      } while (remaining > 0)
      setNeedingRepair(0)
      setDone(true)
      onRepaired?.()
    } catch (error) {
      showAppError(error, { feature: 'Repair Generated PDF Backlog' })
    } finally {
      setRunning(false)
    }
  }

  if (needingRepair === null || (needingRepair === 0 && !done)) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      background: done ? '#f0fdf4' : '#fef9c3', border: `1px solid ${done ? '#bbf7d0' : '#fde68a'}`,
      borderRadius: 10, padding: '10px 14px', fontSize: 13.5,
    }}>
      {done ? (
        <span style={{ color: '#166534' }}>
          PDF backlog repair complete — {progress.regenerated} regenerated with the official template
          {progress.stillFailed > 0 ? `, ${progress.stillFailed} still need review (converter may still be down)` : ''}.
        </span>
      ) : (
        <span style={{ color: '#854d0e' }}>
          {running
            ? `Regenerating official PDFs… ${progress.regenerated} done${progress.stillFailed > 0 ? `, ${progress.stillFailed} still failing` : ''}.`
            : `${needingRepair} invoice${needingRepair === 1 ? '' : 's'} ${needingRepair === 1 ? 'is' : 'are'} missing the official generated PDF (or only has a basic fallback version).`}
        </span>
      )}
      {!done && <Button className="btn-sm" disabled={running} onClick={runRepair}>{running ? 'Repairing…' : 'Repair Now'}</Button>}
    </div>
  )
}
