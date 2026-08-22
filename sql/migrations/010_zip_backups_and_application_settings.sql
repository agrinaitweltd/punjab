-- Portable ZIP backups and structured non-secret application preferences.
update storage.buckets set allowed_mime_types = array['application/zip', 'application/gzip', 'application/json'] where id = 'system-backups';

create table if not exists public.application_settings (
  id boolean primary key default true check (id),
  company jsonb not null default '{}'::jsonb,
  invoicing jsonb not null default '{}'::jsonb,
  customers jsonb not null default '{}'::jsonb,
  payments jsonb not null default '{}'::jsonb,
  communications jsonb not null default '{}'::jsonb,
  files jsonb not null default '{}'::jsonb,
  interface jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.application_settings(id) values(true) on conflict(id) do nothing;
alter table public.application_settings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='application_settings' and policyname='application_settings_admin_read') then
    create policy application_settings_admin_read on public.application_settings for select to authenticated using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='application_settings' and policyname='application_settings_admin_write') then
    create policy application_settings_admin_write on public.application_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
