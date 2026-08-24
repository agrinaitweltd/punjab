-- Authorised-admin imports and normalized credit-note document storage.
-- Additive only: no existing accounts, documents, or finance rows are removed.

create or replace function public.is_admin() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_staff staff
    where staff.auth_user_id = (select auth.uid())
      and coalesce(staff.active, true)
  )
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

alter table public.credit_notes add column if not exists original_invoice_reference text;
alter table public.credit_notes add column if not exists total_goods numeric(12,2) not null default 0;
alter table public.credit_notes add column if not exists total_vat numeric(12,2) not null default 0;
alter table public.credit_notes add column if not exists source_document_id text;
alter table public.credit_notes add column if not exists source_file_name text;
alter table public.credit_notes add column if not exists imported_metadata jsonb not null default '{}'::jsonb;

create table if not exists public.credit_note_items (
  id text primary key default gen_random_uuid()::text,
  credit_note_id text not null references public.credit_notes(id) on delete cascade,
  line_number text,
  quantity numeric(12,3) not null default 0,
  product text not null,
  variety text,
  size text,
  price numeric(12,2) not null default 0,
  goods_value numeric(12,2) not null default 0,
  vat_code text,
  vat_rate numeric(7,4) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists credit_note_items_credit_note_id_idx
  on public.credit_note_items(credit_note_id, created_at);
create unique index if not exists credit_notes_import_identity_uidx
  on public.credit_notes(lower(credit_number), customer_id, date);
create index if not exists invoices_import_identity_idx
  on public.invoices(lower(invoice_number), customer_id, date);

alter table public.credit_note_items enable row level security;
grant select, insert, update, delete on public.credit_note_items to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'credit_note_items'
      and policyname = 'credit_note_items_admin_all'
  ) then
    create policy credit_note_items_admin_all on public.credit_note_items
      for all to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;
