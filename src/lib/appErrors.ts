/** Punjab Exotic Foods application error codes (200-800 range). These are
 *  OUR user-facing codes, not a replacement for real HTTP/API status codes -
 *  those are still logged/handled internally (see resolveAppError below).
 *  Keep this list documented and in sync with what's actually thrown. */
export type AppErrorDefinition = { title: string; message: string; retryable: boolean }

export const APP_ERRORS: Record<number, AppErrorDefinition> = {
  201: { title: 'Invoice Already Uploaded', message: 'This invoice appears to already exist in the system. Check the invoice number and customer account before trying again.', retryable: false },
  202: { title: 'Invoice Number Already Exists', message: 'Another invoice already uses this invoice number. Check the number on the source document and correct it before saving.', retryable: true },
  203: { title: 'Invoice Could Not Be Parsed', message: "We couldn't read this document reliably. Try the original PDF, JPG or PNG file, or enter the details manually.", retryable: true },
  204: { title: 'No Product Lines Detected', message: 'No product rows were found on this document. Add at least one product line before saving.', retryable: true },
  205: { title: 'Invoice PDF Could Not Be Generated', message: 'The official invoice PDF could not be generated from the approved template. The invoice itself has been saved.', retryable: true },
  206: { title: 'Invoice PDF Upload Failed', message: 'The invoice was saved, but its PDF could not be stored. Try generating and uploading it again from the invoice.', retryable: true },
  211: { title: 'Credit Note Already Uploaded', message: 'This credit note appears to already exist for this customer and date. Check before trying again.', retryable: false },
  212: { title: 'Original Invoice Could Not Be Found', message: "We couldn't match this credit note to an existing invoice. Upload the missing invoice first, or link this credit note to a different invoice.", retryable: false },
  213: { title: 'Credit Note Could Not Be Allocated', message: 'This credit amount could not be applied — it may exceed the credit note balance or the invoice outstanding balance.', retryable: true },
  301: { title: 'Customer Could Not Be Created', message: "The customer account couldn't be saved. Check the required fields and try again.", retryable: true },
  302: { title: 'Customer Already Exists', message: 'A customer with these details already exists. Search for them instead of creating a new account.', retryable: false },
  303: { title: 'Customer Account Number Already Exists', message: 'Another customer already uses this account number. Confirm the correct number and try again.', retryable: true },
  401: { title: 'Permission Denied', message: 'You do not have permission to perform this action. Contact a System Developer if you believe this is incorrect.', retryable: false },
  402: { title: 'Identity Verification Failed', message: 'The password entered did not match your account. Try again.', retryable: true },
  403: { title: 'Session Expired', message: 'Your session has expired. Please sign in again to continue.', retryable: false },
  501: { title: 'Email Could Not Be Sent', message: 'This email could not be delivered. You can try again, or check the recipient address.', retryable: true },
  502: { title: 'Email Provider Rejected the Message', message: 'Our email provider rejected this message. This is usually temporary — try again shortly.', retryable: true },
  503: { title: 'Password Reset Email Could Not Be Sent', message: "We couldn't send the password reset email. Check the email address and try again.", retryable: true },
  504: { title: 'Admin Invitation Email Failed', message: "The invitation could not be emailed. The account was not left in a broken state — try sending the invitation again.", retryable: true },
  601: { title: 'File Upload Failed', message: 'This file could not be uploaded. Check your connection and try again.', retryable: true },
  602: { title: 'File Type Not Supported', message: 'That file type is not supported here. Use a PDF, JPG or PNG file.', retryable: false },
  603: { title: 'File Exceeds the Allowed Size', message: 'This file is too large to upload. Reduce the file size and try again.', retryable: false },
  701: { title: 'Connection Failed', message: "We couldn't reach the database. Check your connection and try again.", retryable: true },
  702: { title: 'Database Operation Failed', message: 'That action could not be completed. Try again, and report this if it keeps happening.', retryable: true },
  703: { title: 'Storage Operation Failed', message: 'A file storage action could not be completed. Try again, and report this if it keeps happening.', retryable: true },
  801: { title: 'Unexpected System Error', message: 'Something went wrong that we did not expect. Try again, and send us the details if it keeps happening.', retryable: true },
}

export type ResolvedAppError = AppErrorDefinition & { code: number; technicalDetail: string }

const RECORD_TEST_MATCHERS: Array<[RegExp, number]> = [
  [/this invoice has already been imported/, 201],
  [/that invoice number already exists/, 202],
  [/no product lines detected|at least one valid product row/, 204],
  [/official invoice document could not be generated|official invoice pdf conversion failed/, 205],
  [/pdf references could not be linked|its pdf could not be linked/, 206],
  [/this credit note has already been imported|that credit note number already exists/, 211],
  [/create the customer from an invoice first|original invoice not found|original invoice could not be found/, 212],
  [/credit amount exceeds|only active credit notes|credit note not found/, 213],
  [/could not create the customer|company name is required/, 301],
  [/customer with that email already exists|customer with these details already exists/, 302],
  [/account number already exists|account number must be exactly/, 303],
  [/administrator access required|permission denied|42501|do not have permission/, 401],
  [/incorrect password|password did not match|verify your password/, 402],
  [/session has expired|please sign in again|authentication required/, 403],
  [/could not read that document|could not be read reliably/, 203],
  [/invitation .* could not be delivered|invitation delivery failed/, 504],
  [/password reset .* (failed|could not)/, 503],
  [/email .* rejected|resend/, 502],
  [/email could not be sent|delivery failed/, 501],
  [/file type not supported|unsupported file/, 602],
  [/file (is )?too large|exceeds the allowed size/, 603],
  [/upload (failed|could not)/, 601],
  [/failed to fetch|network|timeout|load failed|connection was interrupted|supabase connection/, 701],
  [/23505|duplicate key/, 702],
  [/storage/, 703],
]

/** Generalizes the pattern from importErrors.ts (Postgres code / message
 *  regex matching) into an app-wide resolver, so every catch block can show
 *  a consistent Punjab Exotic Foods error code instead of a raw message. */
export function resolveAppError(error: unknown, fallbackCode = 801): ResolvedAppError {
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
  const pgCode = typeof record?.code === 'string' ? record.code : ''
  const haystack = `${pgCode} ${detail}`.toLowerCase()

  // An explicit numeric code (e.g. thrown as `Object.assign(new Error(...), { appErrorCode: 213 })`)
  // always wins over pattern matching.
  const explicit = typeof record?.appErrorCode === 'number' ? record.appErrorCode : null
  const code = explicit && APP_ERRORS[explicit] ? explicit : RECORD_TEST_MATCHERS.find(([pattern]) => pattern.test(haystack))?.[1] ?? fallbackCode
  const definition = APP_ERRORS[code] ?? APP_ERRORS[801]
  return { ...definition, code, technicalDetail: detail || String(error) }
}

/** Throw this (or use resolveAppError's explicit-code path) when the throw
 *  site already knows exactly which app error code applies. */
export function appError(code: number, detail?: string): Error {
  const definition = APP_ERRORS[code] ?? APP_ERRORS[801]
  const error = new Error(detail || definition.message)
  Object.assign(error, { appErrorCode: code })
  return error
}
