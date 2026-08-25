export function importFailureMessage(error: unknown, fallback: string): string {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : null
  const detail = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : typeof record?.message === 'string'
        ? record.message
        : typeof record?.details === 'string'
          ? record.details
          : ''
  const code = typeof record?.code === 'string' ? record.code : ''
  const normalized = `${code} ${detail}`.toLowerCase()

  if (/23505|duplicate key|already exists/.test(normalized)) {
    return 'This customer or invoice already exists. Close this window, refresh Customers, and open the existing customer account to add another invoice.'
  }
  if (/42501|row-level security|permission denied|administrator access required/.test(normalized)) {
    return 'Your admin account does not currently have permission to complete this import. Ask a System Developer to enable customer and invoice import access.'
  }
  if (/failed to fetch|network|timeout|load failed/.test(normalized)) {
    return 'The connection was interrupted before the import completed. Check your internet connection, refresh Customers, and try again.'
  }
  return detail ? `Import failed: ${detail}` : fallback
}
