-- Additive system-security foundation. No production business rows are changed.

create or replace function public.is_admin() returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('admin', 'system_developer'), false)
$$;

create or replace function public.is_system_developer() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_staff
    where auth_user_id = auth.uid()
      and active = true
      and role = 'System Developer'
  )
$$;

alter table public.admin_staff add column if not exists invitation_status text
  check (invitation_status in ('Pending', 'Sent', 'Accepted', 'Failed', 'Revoked'));
alter table public.admin_staff add column if not exists last_invited_at timestamptz;

create table if not exists public.system_settings (
  id boolean primary key default true check (id),
  test_mode boolean not null default false,
  test_mode_changed_at timestamptz,
  test_mode_changed_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.system_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.user_login_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  account_id text,
  email text,
  role text,
  login_at timestamptz not null default now(),
  success boolean not null,
  failure_code text,
  ip_hash text,
  user_agent_summary text
);
create index if not exists user_login_audit_login_at_idx on public.user_login_audit (login_at desc);
create index if not exists user_login_audit_user_id_idx on public.user_login_audit (user_id, login_at desc);

create table if not exists public.system_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists system_audit_log_created_at_idx on public.system_audit_log (created_at desc);
create index if not exists system_audit_log_actor_idx on public.system_audit_log (actor_user_id, created_at desc);

create table if not exists public.system_backups (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'Supabase',
  backup_type text not null,
  status text not null check (status in ('Requested', 'Running', 'Completed', 'Failed')),
  provider_reference text,
  size_bytes bigint,
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text
);
create index if not exists system_backups_requested_at_idx on public.system_backups (requested_at desc);

alter table public.system_settings enable row level security;
alter table public.user_login_audit enable row level security;
alter table public.system_audit_log enable row level security;
alter table public.system_backups enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='system_settings' and policyname='system_settings_authenticated_read') then
    create policy system_settings_authenticated_read on public.system_settings for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_login_audit' and policyname='user_login_audit_developer_read') then
    create policy user_login_audit_developer_read on public.user_login_audit for select to authenticated using (public.is_system_developer());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='system_audit_log' and policyname='system_audit_log_developer_read') then
    create policy system_audit_log_developer_read on public.system_audit_log for select to authenticated using (public.is_system_developer());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='system_backups' and policyname='system_backups_developer_read') then
    create policy system_backups_developer_read on public.system_backups for select to authenticated using (public.is_system_developer());
  end if;
end $$;

insert into public.admin_roles (id, name, description, permissions, is_system)
values (
  'role-system-developer',
  'System Developer',
  'Restricted technical and security administration role.',
  '{"customers":true,"prices":true,"stock":true,"orders":true,"enquiries":true,"tickets":true,"payments":true,"complaints":true,"extracts":true,"stats":true,"admins":true,"products":true,"customersCreate":true,"customersDelete":true,"invoicesDelete":true,"paymentsRecord":true,"paymentsDelete":true,"paymentsAllocate":true,"buyingPricesEdit":true,"creditNotesIssue":true,"applicationsManage":true,"usersManage":true}'::jsonb,
  true
)
on conflict (name) do update set description = excluded.description, permissions = excluded.permissions, is_system = true;

revoke all on public.system_settings, public.user_login_audit, public.system_audit_log, public.system_backups from anon;
grant select on public.system_settings to authenticated;
grant select on public.user_login_audit, public.system_audit_log, public.system_backups to authenticated;
