/** Circular progress ring with the percentage centered. Pass `percent` for a
 *  real, measurable value; omit it (or pass undefined) for an indeterminate
 *  spin when no true percentage is available - never invent a fake number. */
export function CircularProgress({ percent, size = 72, label }: { percent?: number; size?: number; label?: string }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = percent === undefined ? undefined : Math.max(0, Math.min(100, percent))
  const offset = clamped === undefined ? circumference * 0.75 : circumference * (1 - clamped / 100)
  return (
    <div className="circular-progress" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={clamped === undefined ? 'cp-indeterminate' : undefined}>
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth="6" className="cp-track" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} strokeWidth="6" className="cp-value" fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <div className="circular-progress-label">
        {clamped === undefined ? (label ?? '') : `${Math.round(clamped)}%`}
      </div>
    </div>
  )
}
