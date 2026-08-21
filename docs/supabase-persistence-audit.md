# Supabase Persistence Audit

Audited and remediated 21 August 2026 against project `vqnnlorukpzsftfisjrm`.

## Live state

- All 3 administrators and 4 customers are linked to distinct Supabase Auth users.
- No plaintext passwords remain in `admin_staff` or `customers`.
- RLS is enabled on all 24 core policy targets and every normalized finance/document table.
- Anonymous REST checks return zero rows for core business and normalized finance/document tables.
- An authenticated developer-admin session can read the expected live rows through the same Data API.
- `salesmen`, `assigned_tasks`, and `customer_sub_accounts` were added additively to resolve schema drift.

## Finance integrity

- All 158 imported documents have zero paid amount and no false paid status.
- Six negative credit documents are retained but contribute zero to receivables.
- Positive unpaid balances total GBP 37,103.73 across 152 invoices.
- Customer balances are synchronized to that same total with zero mismatches.

## Storage

The `customer-documents` bucket is private, limited to 10 MB, and accepts only PDF and DOCX files. Storage policies require an administrator JWT. Existing compatibility records remain available; no document or business row was deleted.

## Verification

`test:live-auth`, `test:production-smoke`, `test:live-rls`, and desktop/mobile Playwright tests passed against `https://punjabuk.vercel.app`.
