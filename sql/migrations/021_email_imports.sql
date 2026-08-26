-- Email PDF import tracking (receivables@punjabexoticfoods.com via IONOS
-- IMAP). Rows are written only by the service-role-backed mailbox worker
-- (api/cron-check-mailbox.js) and the retry admin action
-- (server/admin-actions/email-imports.js) - never directly from the client,
-- same pattern as application_error_log (019).
--
-- Duplicate protection: (message_id, attachment_filename) is unique so the
-- same IMAP message/attachment is never processed twice even if the mailbox
-- poll overlaps or a message is re-fetched after a restart. attachment_hash
-- (sha256 of the PDF bytes) is indexed, not unique, because a legitimately
-- re-sent PDF should still show up as a tracked "Duplicate" row rather than
-- fail an insert - the worker checks it before creating an invoice/credit
-- note, not the database.

create table if not exists public.email_imports (
  id                     text primary key default gen_random_uuid()::text,
  message_id             text not null,
  uid                    bigint,
  received_at            timestamptz,
  sender                 text,
  subject                text,
  attachment_filename    text not null,
  attachment_hash        text not null,
  attachment_size        bigint,
  status                 text not null default 'processing'
                           check (status in ('processing', 'imported', 'needs_review', 'failed', 'duplicate')),
  document_type          text check (document_type in ('invoice', 'credit_note')),
  detected_customer_id   text references public.customers(id) on delete set null,
  detected_customer_name text,
  detected_invoice_number text,
  invoice_id             text references public.invoices(id) on delete set null,
  credit_note_id         text references public.credit_notes(id) on delete set null,
  file_id                text,
  error_message          text,
  processed_at           timestamptz,
  created_at             timestamptz not null default now(),
  unique (message_id, attachment_filename)
);

create index if not exists idx_email_imports_hash on public.email_imports (attachment_hash);
create index if not exists idx_email_imports_created_at on public.email_imports (created_at desc);
create index if not exists idx_email_imports_status on public.email_imports (status);

alter table public.email_imports enable row level security;

create policy "email_imports_admin_read" on public.email_imports for select
  using (is_admin());

-- No insert/update/delete policy for authenticated/anon - rows are written
-- only by the service-role client in the mailbox worker and retry action.

-- Test Mode mirror table, same shape, same policy.
create table if not exists public.test_email_imports (like public.email_imports including all);
alter table public.test_email_imports enable row level security;
create policy "test_email_imports_admin_read" on public.test_email_imports for select
  using (is_admin());

-- Realtime: admins should see new/updated import rows live, same as every
-- other table wired in 020_realtime_publication.sql.
alter publication supabase_realtime add table email_imports, test_email_imports;

-- Tracks the highest IMAP UID the mailbox worker has already scanned (one
-- row per mode: id='live' or id='test'), so a poll never re-downloads/
-- re-parses emails it has already looked at just because none of them had a
-- PDF attachment (email_imports only gets a row when there WAS one, so it
-- can't be used as this high-water-mark on its own). Never exposed in the
-- admin UI - purely worker bookkeeping, service-role only.
create table if not exists public.email_import_cursor (
  id text primary key,
  last_uid bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.email_import_cursor enable row level security;
