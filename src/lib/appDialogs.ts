import { resolveAppError } from './appErrors'

export type ConfirmRequest = { message: string; resolve: (confirmed: boolean) => void }

export function confirmAction(message: string): Promise<boolean> {
  return new Promise(resolve => window.dispatchEvent(new CustomEvent<ConfirmRequest>('app-confirm', { detail: { message, resolve } })))
}

export function showNotice(message: string): void {
  window.dispatchEvent(new CustomEvent<string>('app-notice', { detail: message }))
}

/** Auto-dismissing success confirmation (e.g. "Customer imported
 *  successfully") - separate from the live order/ticket notification stream
 *  in ToastStack.tsx, which has its own detect-what-changed semantics. */
export function showSuccess(message: string): void {
  window.dispatchEvent(new CustomEvent<string>('app-success', { detail: message }))
}

export type AppErrorRequest = {
  code: number
  title: string
  message: string
  technicalDetail: string
  retryable: boolean
  feature?: string
  context?: Record<string, unknown>
  retry?: () => void
}

/** Shows a coded Punjab Exotic Foods error (see src/lib/appErrors.ts) via the
 *  shared AppErrorDialog, with an optional retry callback and a "Send this
 *  error to System Developer" path. Pass a raw `error` and this resolves it
 *  to a code automatically; pass `fallbackCode` to bias unmatched errors. */
export function showAppError(error: unknown, options: { feature?: string; context?: Record<string, unknown>; retry?: () => void; fallbackCode?: number } = {}): void {
  const resolved = resolveAppError(error, options.fallbackCode)
  const detail: AppErrorRequest = { ...resolved, feature: options.feature, context: options.context, retry: options.retry }
  window.dispatchEvent(new CustomEvent<AppErrorRequest>('app-error', { detail }))
}
