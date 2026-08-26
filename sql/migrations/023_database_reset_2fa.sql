-- Two-factor "reset business data" module for System Developer accounts
-- only (server/admin-actions/database-reset.js). Never touches admin_staff,
-- auth.users, admin_roles or any other login/account data - only the
-- transactional business tables the admin explicitly asked for (customers,
-- invoices, their line items/payments/credit notes, stored PDFs/documents,
-- email-import tracking).

alter table public.admin_staff add column if not exists reset_pin_hash text;
alter table public.admin_staff add column if not exists reset_pin_set_at timestamptz;

-- One-time email verification codes for the reset flow. Service-role only -
-- RLS enabled with no policies, same pattern as email_import_cursor (019/021).
create table if not exists public.database_reset_codes (
  id uuid primary key default gen_random_uuid(),
  admin_staff_id text not null references public.admin_staff(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_database_reset_codes_admin on public.database_reset_codes (admin_staff_id, created_at desc);
alter table public.database_reset_codes enable row level security;
