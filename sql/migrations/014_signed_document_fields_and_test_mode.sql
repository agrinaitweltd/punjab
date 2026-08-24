-- Preserve signed source values and keep document imports complete in live and test mode.
-- Additive only: no existing records are changed or removed.

alter table public.invoices add column if not exists total_goods numeric(12,2) not null default 0;
alter table public.invoices add column if not exists total_vat numeric(12,2) not null default 0;
alter table public.invoices add column if not exists packages numeric(12,3) not null default 0;
alter table public.invoices add column if not exists imported_metadata jsonb not null default '{}'::jsonb;
alter table public.invoice_items add column if not exists vat_amount numeric(12,2) not null default 0;

alter table public.test_invoices add column if not exists total_goods numeric(12,2) not null default 0;
alter table public.test_invoices add column if not exists total_vat numeric(12,2) not null default 0;
alter table public.test_invoices add column if not exists packages numeric(12,3) not null default 0;
alter table public.test_invoices add column if not exists imported_metadata jsonb not null default '{}'::jsonb;
alter table public.test_invoice_items add column if not exists vat_amount numeric(12,2) not null default 0;
alter table public.test_credit_notes add column if not exists original_invoice_reference text;
alter table public.test_credit_notes add column if not exists total_goods numeric(12,2) not null default 0;
alter table public.test_credit_notes add column if not exists total_vat numeric(12,2) not null default 0;
alter table public.test_credit_notes add column if not exists source_document_id text;
alter table public.test_credit_notes add column if not exists source_file_name text;
alter table public.test_credit_notes add column if not exists imported_metadata jsonb not null default '{}'::jsonb;

create table if not exists public.test_credit_note_items
  (like public.credit_note_items including all);
alter table public.test_credit_note_items enable row level security;
grant select, insert, update, delete on public.test_credit_note_items to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'test_credit_note_items' and policyname = 'credit_note_items_admin_all'
  ) then
    create policy credit_note_items_admin_all on public.test_credit_note_items
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

create or replace function public.prepare_test_mode_data() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  source_table text;
  sandbox_table text;
  copied bigint;
  total_rows bigint := 0;
  sandbox_tables text[] := array[
    'activity_log', 'assigned_tasks', 'buying_prices', 'buying_sessions',
    'communication_logs', 'credit_note_allocations', 'credit_note_items', 'credit_notes',
    'customer_applications', 'customer_sub_accounts', 'customers', 'day_trades',
    'delivery_areas', 'expenses', 'finance_settings', 'generated_documents',
    'invoice_items', 'invoices', 'notification_logs', 'orders', 'payments',
    'products', 'salesmen', 'stock_items', 'suppliers', 'support_tickets',
    'whatsapp_logs', 'whatsapp_templates'
  ];
begin
  foreach source_table in array sandbox_tables loop
    sandbox_table := 'test_' || source_table;
    execute format('truncate table public.%I', sandbox_table);
    execute format('insert into public.%I select * from public.%I', sandbox_table, source_table);
    get diagnostics copied = row_count;
    total_rows := total_rows + copied;
  end loop;
  return jsonb_build_object('tables', cardinality(sandbox_tables), 'rows', total_rows);
end;
$$;

create or replace function public.reset_test_mode_data() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  source_table text;
  sandbox_tables text[] := array[
    'activity_log', 'assigned_tasks', 'buying_prices', 'buying_sessions',
    'communication_logs', 'credit_note_allocations', 'credit_note_items', 'credit_notes',
    'customer_applications', 'customer_sub_accounts', 'customers', 'day_trades',
    'delivery_areas', 'expenses', 'finance_settings', 'generated_documents',
    'invoice_items', 'invoices', 'notification_logs', 'orders', 'payments',
    'products', 'salesmen', 'stock_items', 'suppliers', 'support_tickets',
    'whatsapp_logs', 'whatsapp_templates'
  ];
begin
  foreach source_table in array sandbox_tables loop
    execute format('truncate table public.%I', 'test_' || source_table);
  end loop;
  return jsonb_build_object('tables_reset', cardinality(sandbox_tables));
end;
$$;

revoke all on function public.prepare_test_mode_data() from public, anon, authenticated;
revoke all on function public.reset_test_mode_data() from public, anon, authenticated;
grant execute on function public.prepare_test_mode_data() to service_role;
grant execute on function public.reset_test_mode_data() to service_role;
