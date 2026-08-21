# Production Security Review - 22 August 2026

## Completed controls

- Supabase Auth remains the production identity provider.
- The confirmed `info@kavotech.uk` account is retained as the sole System Developer account; no duplicate account or administrator-selected password was created.
- New administrator accounts use server-generated, one-time Supabase setup links sent by email.
- User invitations, role changes, disabling and safe removal require a fresh current-password check. The resulting signed action token expires after 10 minutes.
- System Developer access is checked against the active live roster on the server and in database policies.
- Login attempts and sensitive administrative actions are written to restricted audit tables. Passwords, session tokens, setup links and secrets are excluded.
- Test Mode is globally visible but cannot be enabled in this release. Activation is locked until a separate Supabase project and a verified test-data adapter exist.
- Removal preserves historical business records and disables the linked Auth user instead of deleting related company data.

## Live Supabase verification

- Migration `008_system_security_and_audit.sql` was applied transactionally.
- The four new system tables have Row Level Security enabled and four restricted read policies are present.
- Existing production business data was retained. Verification immediately after migration found 4 customers and 158 invoices.
- Auth Site URL is `https://www.punjabexoticfoods.com` with the production and approved Vercel aliases allow-listed.
- Minimum Auth password length is 10 and password-change reauthentication is enabled.
- The private `customer-documents` bucket remains private.

## Backup boundary

Supabase-managed database backup availability is shown as provider-controlled. Restore is intentionally not exposed in the application. Database backups include Storage metadata, not a recoverable copy of deleted Storage objects, so the UI does not claim otherwise.

## Verification performed

- TypeScript production build
- Oxlint
- API security route tests, including signed sensitive-action token checks
- Finance workflow tests
- Invoice parser tests
- Desktop and mobile Playwright checks for login and System Developer layouts
- Horizontal-overflow checks at 1440x900 and 390x844

## Deliberately unavailable

- Global Test Mode activation, pending a physically separate test project and completed repository adapter
- In-application production restore, which remains a Supabase provider operation

These restrictions prevent test transactions or an unverified restore workflow from modifying live company data.
