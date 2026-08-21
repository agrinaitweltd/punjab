export type ConfirmRequest = { message: string; resolve: (confirmed: boolean) => void }

export function confirmAction(message: string): Promise<boolean> {
  return new Promise(resolve => window.dispatchEvent(new CustomEvent<ConfirmRequest>('app-confirm', { detail: { message, resolve } })))
}

export function showNotice(message: string): void {
  window.dispatchEvent(new CustomEvent<string>('app-notice', { detail: message }))
}
