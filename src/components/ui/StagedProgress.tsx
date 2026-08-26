import { Spinner } from './Spinner'

/** Shows real stage transitions for a multi-step operation (e.g. Import
 *  Customer) instead of a single "Saving..." line. `activeStage` is matched
 *  by label against `stages`; steps before it are marked done, the matching
 *  one shows a spinner, later ones are pending. No fake percentages. */
export function StagedProgress({ stages, activeStage }: { stages: string[]; activeStage: string }) {
  const activeIndex = stages.indexOf(activeStage)
  return (
    <div className="staged-progress" role="status" aria-live="polite">
      <div className="staged-progress-count">
        {activeIndex >= 0 ? `Step ${activeIndex + 1} of ${stages.length}` : activeStage}
      </div>
      <ul className="staged-progress-list">
        {stages.map((stage, index) => {
          const state = activeIndex < 0 ? 'pending' : index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending'
          return (
            <li key={stage} className={`staged-progress-item ${state}`}>
              <span className="staged-progress-icon">
                {state === 'done' ? '✓' : state === 'active' ? <Spinner size={13} /> : ''}
              </span>
              <span>{stage}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
