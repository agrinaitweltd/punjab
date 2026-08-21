# Supabase Persistence Audit

Audited 21 August 2026 against the configured Supabase project.

## Live durable tables

- Customers: `customers`
- Invoices and due/payment status: `invoices`
- Payments and invoice allocations: `payments`
- Email reminder logs: `notification_logs`
- WhatsApp messages and failures: `whatsapp_logs`
- Files, expenses, finance settings, and invoice-item compatibility records: `activity_log`

An isolated create/read/update test confirmed that a customer, invoice, payment,
paid status, zero customer balance, invoice products, PDF record, expense, and
communication log remained readable through fresh REST requests. Test rows were
removed by their unique test IDs after verification.

## Migrations not active in the live project

The REST schema returns 404 for `invoice_items`, `expenses`, `portal_invitations`,
`generated_documents`, and `finance_settings`. Migration 004 defines these
normalized tables. Until it is run, the app deliberately uses database-backed
`activity_log` compatibility records for invoice items, expenses, files, and
finance settings. Portal invitation status and normalized generated-document
metadata are not available.

## Storage

Generated PDFs currently persist as private application data in `activity_log`;
they are not in a Supabase Storage bucket. Migration 005 prepares the private
`customer-documents` bucket and metadata fields. Its policies require Supabase
Auth admin JWTs. The legacy app session is not a Supabase Auth session, so moving
files before that identity migration would either break uploads or require an
unsafe anonymous Storage policy.

## Local-only state

- Remembered-device credentials, notification-seen markers, and salesperson
  browser sessions are intentionally device/session preferences.
- Brand-history undo data and Daily Session draft state use browser storage.
- Service mock arrays are offline fallbacks used only when Supabase environment
  variables are absent; they are not the production source of truth.

## Required production configuration

1. Run migration 004 in the Supabase SQL editor.
2. Complete Supabase Auth for admins and attach `app_metadata.role = admin`.
3. Run migration 005 and switch fileService to the private Storage bucket.
4. Set `CONVERTAPI_TOKEN` in Vercel for exact Word-to-PDF conversion.
5. Keep `ULTRAMSG_TOKEN` and email-provider credentials configured for sending.
