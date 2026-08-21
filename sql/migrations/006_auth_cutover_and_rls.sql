-- Production Auth/RLS cutover prerequisites. Existing business rows are not
-- changed or removed by this migration.

create or replace function public.is_admin() returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

do $$
begin
  if exists (select 1 from public.admin_staff where auth_user_id is null) then
    raise exception 'RLS cutover blocked: admin_staff contains unmapped Auth users';
  end if;
  if exists (select 1 from public.customers where auth_user_id is null) then
    raise exception 'RLS cutover blocked: customers contains unmapped Auth users';
  end if;
end $$;
