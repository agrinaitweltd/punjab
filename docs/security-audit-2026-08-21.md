# Security Audit - 21 August 2026

This was an authorized, additive production remediation. Existing business rows and documents were retained.

## Completed

- Migrated all current admin/customer identities to Supabase Auth and bcrypt-protected legacy fields.
- Enabled tested RLS policies on all core and normalized tables, including parent-scoped customer subaccounts.
- Confirmed anonymous Data API requests expose zero business rows.
- Added same-origin, request-size, validation, and rate-limit guards to browser-facing server routes.
- Added JWT verification to email, WhatsApp, address, DOCX, and PDF APIs; privileged routes require the admin role.
- Required `CRON_SECRET` and service-role access for automated reminders.
- Kept generated-document storage private with MIME and size restrictions.
- Added CSP, HSTS, frame denial, MIME-sniffing protection, referrer policy, and permissions policy.
- Removed known plaintext fallback credentials and remembered-device password prompts.
- Reduced the dependency audit to zero known vulnerabilities.

## Verified production behavior

- Valid developer login: HTTP 200.
- Invalid password: HTTP 401.
- Unauthenticated sensitive API: HTTP 401.
- Authenticated admin API reaches payload validation.
- Anonymous RLS checks return no rows; authenticated admin reads succeed.
- Desktop and 390 px mobile dashboard tests pass without horizontal overflow.

## Residual considerations

- Serverless rate limiting is per warm instance; a shared durable limiter is recommended if public traffic grows materially.
- Six negative imported documents are treated as credits and excluded from money due; they remain stored unchanged.
- Vite reports a non-blocking large-chunk warning. Lazy route loading can improve initial download size later.
