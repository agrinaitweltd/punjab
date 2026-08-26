-- Internal application-error log, separate from system_audit_log (which is
-- an "admin did X" audit trail, not an unhandled-exception log). Same RLS
-- pattern: only System Developer can read; writes go through the
-- service-role-backed report-error.js server action, never directly from
-- the client.

create table if not exists public.application_error_log (
  id uuid primary key default extensions.gen_random_uuid(),
  error_code int not null,
  title text not null,
  message text not null,
  severity text not null default 'low' check (severity in ('low', 'medium', 'high')),
  user_id uuid,
  user_email text,
  feature text,
  technical_detail text,
  context jsonb,
  correlation_id text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_application_error_log_created_at on public.application_error_log (created_at desc);
create index if not exists idx_application_error_log_resolved on public.application_error_log (resolved) where not resolved;

alter table public.application_error_log enable row level security;

create policy "application_error_log_developer_read" on public.application_error_log for select
  using (is_system_developer());

create policy "application_error_log_developer_update" on public.application_error_log for update
  using (is_system_developer()) with check (is_system_developer());

-- No insert/delete policy for authenticated/anon - rows are written only by
-- report-error.js using the service-role key, which bypasses RLS entirely.
