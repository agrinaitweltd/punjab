import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

function loadModule(file) {
  const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

const { APP_ERRORS, resolveAppError, appError } = await loadModule('../src/lib/appErrors.ts')

// Every code the user asked for by name must exist, with the exact title.
const expected = {
  201: 'Invoice Already Uploaded', 202: 'Invoice Number Already Exists', 203: 'Invoice Could Not Be Parsed',
  204: 'No Product Lines Detected', 205: 'Invoice PDF Could Not Be Generated', 206: 'Invoice PDF Upload Failed',
  211: 'Credit Note Already Uploaded', 212: 'Original Invoice Could Not Be Found', 213: 'Credit Note Could Not Be Allocated',
  301: 'Customer Could Not Be Created', 302: 'Customer Already Exists', 303: 'Customer Account Number Already Exists',
  401: 'Permission Denied', 402: 'Identity Verification Failed', 403: 'Session Expired',
  501: 'Email Could Not Be Sent', 502: 'Email Provider Rejected the Message', 503: 'Password Reset Email Could Not Be Sent', 504: 'Admin Invitation Email Failed',
  601: 'File Upload Failed', 602: 'File Type Not Supported', 603: 'File Exceeds the Allowed Size',
  701: 'Connection Failed', 702: 'Database Operation Failed', 703: 'Storage Operation Failed',
  801: 'Unexpected System Error',
}
for (const [code, title] of Object.entries(expected)) {
  assert.ok(APP_ERRORS[code], `missing error code ${code}`)
  assert.equal(APP_ERRORS[code].title, title)
}

// Pattern matching against real thrown-error messages from the app.
assert.equal(resolveAppError(new Error('This invoice has already been imported for that customer and date.')).code, 201)
assert.equal(resolveAppError(new Error('That invoice number already exists.')).code, 202)
assert.equal(resolveAppError(new Error('This credit note has already been imported for that customer and date.')).code, 211)
assert.equal(resolveAppError(new Error('Create the customer from an invoice first, then add the credit note from their customer account.')).code, 212)
assert.equal(resolveAppError(new Error('Credit amount exceeds the invoice outstanding balance')).code, 213)
assert.equal(resolveAppError({ code: '23505', message: 'duplicate key value violates unique constraint' }).code, 702)
assert.equal(resolveAppError({ code: '42501', message: 'permission denied for table invoices' }).code, 401)
assert.equal(resolveAppError(new Error('Failed to fetch')).code, 701)
assert.equal(resolveAppError(new Error('Something nobody predicted')).code, 801)

// Never leaks raw technical detail into the user-facing title/message.
const resolved = resolveAppError(new Error('permission denied for table invoices'))
assert.equal(resolved.title, 'Permission Denied')
assert.ok(!resolved.message.includes('table invoices'))
assert.equal(resolved.technicalDetail, 'permission denied for table invoices')

// appError() round-trips through resolveAppError via the explicit-code path.
const thrown = appError(213, 'custom detail')
assert.equal(resolveAppError(thrown).code, 213)
assert.equal(resolveAppError(thrown).technicalDetail, 'custom detail')

console.log('App error-code resolution tests passed')
