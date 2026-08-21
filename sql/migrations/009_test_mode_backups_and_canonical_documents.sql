-- Isolated operational sandbox, application backups and canonical invoice metadata.
-- Additive only: existing live business rows and files are not modified.

alter table public.system_settings add column if not exists test_mode_generation uuid;
alter table public.system_settings add column if not exists test_mode_started_at timestamptz;

alter table public.invoices add column if not exists source_document_id text;
alter table public.invoices add column if not exists canonical_document_id text;
alter table public.invoices add column if not exists canonical_pdf_file_name text;
alter table public.invoices add column if not exists canonical_pdf_generated_at timestamptz;

alter table public.notification_logs add column if not exists reminder_stage text;
alter table public.notification_logs add column if not exists idempotency_key text;
create unique index if not exists notification_logs_idempotency_key_idx
  on public.notification_logs (idempotency_key) where idempotency_key is not null;

alter table public.system_backups drop constraint if exists system_backups_status_check;
alter table public.system_backups add constraint system_backups_status_check
  check (status in ('Preparing', 'Running', 'Completed', 'Partial', 'Failed'));
alter table public.system_backups add column if not exists created_by_email text;
alter table public.system_backups add column if not exists database_export_status text;
alter table public.system_backups add column if not exists storage_export_status text;
alter table public.system_backups add column if not exists file_path text;
alter table public.system_backups add column if not exists checksum_sha256 text;
alter table public.system_backups add column if not exists manifest_version integer not null default 1;
alter table public.system_backups add column if not exists table_count integer;
alter table public.system_backups add column if not exists row_count integer;
alter table public.system_backups add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
declare
  source_table text;
  sandbox_table text;
  policy_row record;
  sandbox_tables text[] := array[
    'activity_log', 'assigned_tasks', 'buying_prices', 'buying_sessions',
    'communication_logs', 'credit_note_allocations', 'credit_notes',
    'customer_applications', 'customer_sub_accounts', 'customers', 'day_trades',
    'delivery_areas', 'expenses', 'finance_settings', 'generated_documents',
    'invoice_items', 'invoices', 'notification_logs', 'orders', 'payments',
    'products', 'salesmen', 'stock_items', 'suppliers', 'support_tickets',
    'whatsapp_logs', 'whatsapp_templates'
  ];
begin
  foreach source_table in array sandbox_tables loop
    sandbox_table := 'test_' || source_table;
    execute format('create table if not exists public.%I (like public.%I including all)', sandbox_table, source_table);
    execute format('alter table public.%I enable row level security', sandbox_table);

    for policy_row in
      select policyname, cmd, qual, with_check
      from pg_policies
      where schemaname = 'public' and tablename = source_table
    loop
      if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = sandbox_table and policyname = policy_row.policyname
      ) then
        execute format(
          'create policy %I on public.%I for %s to public%s%s',
          policy_row.policyname,
          sandbox_table,
          policy_row.cmd,
          case when policy_row.qual is not null then format(' using (%s)', policy_row.qual) else '' end,
          case when policy_row.with_check is not null then format(' with check (%s)', policy_row.with_check) else '' end
        );
      end if;
    end loop;
  end loop;
end $$;

create or replace function public.prepare_test_mode_data() returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  source_table text;
  sandbox_table text;
  copied bigint;
  total_rows bigint := 0;
  sandbox_tables text[] := array[
    'activity_log', 'assigned_tasks', 'buying_prices', 'buying_sessions',
    'communication_logs', 'credit_note_allocations', 'credit_notes',
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
language plpgsql security definer
set search_path = ''
as $$
declare
  source_table text;
  sandbox_tables text[] := array[
    'activity_log', 'assigned_tasks', 'buying_prices', 'buying_sessions',
    'communication_logs', 'credit_note_allocations', 'credit_notes',
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('system-backups', 'system-backups', false, 52428800, array['application/gzip', 'application/json']),
  ('test-documents', 'test-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='system_backups_developer_read') then
    create policy system_backups_developer_read on storage.objects for select to authenticated
      using (bucket_id = 'system-backups' and public.is_system_developer());
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='test_documents_admin_all') then
    create policy test_documents_admin_all on storage.objects for all to authenticated
      using (bucket_id = 'test-documents' and public.is_admin())
      with check (bucket_id = 'test-documents' and public.is_admin());
  end if;
end $$;
