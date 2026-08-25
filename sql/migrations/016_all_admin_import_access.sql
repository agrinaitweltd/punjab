-- Every active administrator can import customers, invoices, product rows and
-- source/generated documents. Authentication still requires a linked Auth user.

create or replace function public.is_admin() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_staff staff
    where staff.auth_user_id = (select auth.uid())
      and staff.active = true
  )
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

grant select, insert, update, delete on public.customers, public.invoices,
  public.invoice_items, public.activity_log to authenticated;
grant select, insert, update, delete on public.test_customers, public.test_invoices,
  public.test_invoice_items, public.test_activity_log to authenticated;

alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.activity_log enable row level security;
alter table public.test_customers enable row level security;
alter table public.test_invoices enable row level security;
alter table public.test_invoice_items enable row level security;
alter table public.test_activity_log enable row level security;

update public.admin_staff
set permissions = coalesce(permissions, '{}'::jsonb) ||
  '{"customers":true,"customersCreate":true}'::jsonb,
  invitation_status = coalesce(invitation_status, 'Accepted')
where active = true and auth_user_id is not null;
