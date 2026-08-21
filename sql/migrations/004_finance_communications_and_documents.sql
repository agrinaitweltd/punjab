-- Additive finance/document schema. Existing tables and rows are untouched.
create or replace function public.is_admin() returns boolean language sql stable as $$
  select coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin', false)
$$;
create table if not exists invoice_items (
  id text primary key default gen_random_uuid()::text,
  invoice_id text not null references invoices(id) on delete cascade,
  line_number text, quantity numeric(12,3) not null default 0, product text not null,
  variety text, size text, price numeric(12,2) not null default 0,
  goods_value numeric(12,2) not null default 0, vat_code text, vat_rate numeric(7,4) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists invoice_items_invoice_id_idx on invoice_items(invoice_id);

create table if not exists expenses (
  id text primary key default gen_random_uuid()::text,
  title text not null, category text not null, supplier text,
  amount numeric(12,2) not null check (amount > 0), currency char(3) not null default 'GBP',
  expense_date date not null default current_date, description text, payment_method text,
  reference text, attachment_path text, recorded_by text, created_at timestamptz not null default now()
);
create index if not exists expenses_expense_date_idx on expenses(expense_date desc);
create index if not exists expenses_category_idx on expenses(category);

create table if not exists finance_settings (
  id boolean primary key default true check (id), default_payment_terms_days integer not null default 21 check (default_payment_terms_days >= 0),
  reminder_days_before_due integer not null default 7 check (reminder_days_before_due >= 0), updated_at timestamptz not null default now(), updated_by text
);
insert into finance_settings(id) values(true) on conflict(id) do nothing;

create table if not exists portal_invitations (
  id text primary key default gen_random_uuid()::text, customer_id text not null references customers(id) on delete cascade,
  email text not null, status text not null default 'Pending' check(status in ('Pending','Sent','Accepted','Failed','Cancelled')),
  sent_at timestamptz, accepted_at timestamptz, error text, created_at timestamptz not null default now(), created_by text
);
create index if not exists portal_invitations_customer_id_idx on portal_invitations(customer_id);

create table if not exists generated_documents (
  id text primary key default gen_random_uuid()::text, customer_id text not null references customers(id) on delete cascade,
  invoice_id text references invoices(id) on delete cascade, document_type text not null,
  reference_number text, file_name text not null, file_path text, generated_at timestamptz not null default now(), created_by text
);
create index if not exists generated_documents_customer_id_idx on generated_documents(customer_id);
create index if not exists generated_documents_invoice_id_idx on generated_documents(invoice_id);

create table if not exists communication_logs (
  id text primary key default gen_random_uuid()::text, customer_id text references customers(id) on delete cascade,
  invoice_id text references invoices(id) on delete cascade, communication_type text not null,
  channel text not null check(channel in ('email','whatsapp','system')), recipient text,
  status text not null check(status in ('Pending','Sent','Failed','Skipped','Scheduled')),
  error text, retry_count integer not null default 0, idempotency_key text, created_at timestamptz not null default now(),
  sent_at timestamptz, created_by text, payload jsonb not null default '{}'::jsonb
);
create unique index if not exists communication_logs_idempotency_key_uidx on communication_logs(idempotency_key) where idempotency_key is not null;
create index if not exists communication_logs_invoice_id_idx on communication_logs(invoice_id, created_at desc);
create index if not exists communication_logs_customer_id_idx on communication_logs(customer_id, created_at desc);
create index if not exists communication_logs_failed_idx on communication_logs(created_at desc) where status = 'Failed';

-- These new normalized tables are server/admin-only until Supabase Auth is live.
-- Existing legacy workflows continue using their compatibility rows, so enabling
-- RLS here does not lock out the current application and avoids anon-key exposure.
alter table invoice_items enable row level security;
alter table expenses enable row level security;
alter table finance_settings enable row level security;
alter table portal_invitations enable row level security;
alter table generated_documents enable row level security;
alter table communication_logs enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='expenses' and policyname='expenses_admin_all') then
    create policy expenses_admin_all on expenses for all using (is_admin()) with check (is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='communication_logs' and policyname='communication_logs_admin_all') then
    create policy communication_logs_admin_all on communication_logs for all using (is_admin()) with check (is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='invoice_items' and policyname='invoice_items_admin_all') then
    create policy invoice_items_admin_all on invoice_items for all using (is_admin()) with check (is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='finance_settings' and policyname='finance_settings_admin_all') then
    create policy finance_settings_admin_all on finance_settings for all using (is_admin()) with check (is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='portal_invitations' and policyname='portal_invitations_admin_all') then
    create policy portal_invitations_admin_all on portal_invitations for all using (is_admin()) with check (is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='generated_documents' and policyname='generated_documents_admin_all') then
    create policy generated_documents_admin_all on generated_documents for all using (is_admin()) with check (is_admin());
  end if;
end $$;
