-- Login Activity previously only recorded login attempts, and admin logins
-- were reported by the browser (so they could be skipped by manipulating
-- the client). This widens the table into a general authentication/security
-- event log written from authenticated server-side flows.
alter table public.user_login_audit
  add column if not exists event_type text not null default 'login',
  add column if not exists details jsonb not null default '{}'::jsonb,
  add column if not exists recorded_by text not null default 'client';

-- 'recorded_by' distinguishes an event the server itself observed inside an
-- authenticated handler ('server') from one merely reported by the browser
-- ('client'), so the UI can show which entries are tamper-resistant.
alter table public.user_login_audit
  drop constraint if exists user_login_audit_event_type_check;
alter table public.user_login_audit add constraint user_login_audit_event_type_check
  check (event_type in (
    'login', 'logout', 'password_reset_completed', 'password_changed',
    'admin_activated', 'admin_invited', 'admin_updated', 'credentials_reset',
    'identity_verified', 'identity_verification_failed', 'session_revoked'
  ));

create index if not exists idx_user_login_audit_login_at on public.user_login_audit (login_at desc);
create index if not exists idx_user_login_audit_email on public.user_login_audit (email);
create index if not exists idx_user_login_audit_event_type on public.user_login_audit (event_type);

-- Any active admin may review the security log (previously System Developer
-- only, which meant normal admins could not audit their own account's
-- activity). Writes still only ever happen through the service role.
drop policy if exists "user_login_audit_admin_read" on public.user_login_audit;
create policy "user_login_audit_admin_read" on public.user_login_audit
  for select using (is_admin());
