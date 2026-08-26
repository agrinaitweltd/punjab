-- Customer statements are a third document type alongside invoices and
-- credit notes. A statement SUMMARISES transactions that mostly already
-- exist as their own invoice/payment/credit-note records, so it is stored
-- as a customer document + reconciliation record only - it deliberately
-- never creates financial transactions of its own (see item 10 of the
-- brief: no double-counting).
create table if not exists public.customer_statements (
  id text primary key,
  customer_id text references public.customers(id) on delete set null,
  customer_name text,
  account_number text,
  statement_date date,
  opening_balance numeric,
  closing_balance numeric,
  total_invoiced numeric,
  total_paid numeric,
  total_outstanding numeric,
  invoice_count integer default 0,
  -- 'reconciled' when the statement's figures agree with what the system
  -- already holds for that customer, 'needs_review' when they differ.
  reconciliation_status text not null default 'needs_review'
    check (reconciliation_status in ('reconciled', 'needs_review', 'unmatched_customer')),
  reconciliation_notes jsonb not null default '[]'::jsonb,
  -- Full parsed statement (rows, ageing, totals) for the detail view.
  parsed_data jsonb not null default '{}'::jsonb,
  source_document_id text,
  source_file_name text,
  import_source text not null default 'email' check (import_source in ('email', 'manual')),
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_statements_customer on public.customer_statements (customer_id);
create index if not exists idx_customer_statements_date on public.customer_statements (statement_date desc);
-- Same statement arriving twice (forwarded again) must not create a second row.
create unique index if not exists customer_statements_identity_uidx
  on public.customer_statements (coalesce(customer_id, ''), coalesce(statement_date, '1900-01-01'), coalesce(account_number, ''));

alter table public.customer_statements enable row level security;
create policy "customer_statements_admin_all" on public.customer_statements
  for all using (is_admin()) with check (is_admin());

create table if not exists public.test_customer_statements (like public.customer_statements including all);
alter table public.test_customer_statements enable row level security;
create policy "test_customer_statements_admin_all" on public.test_customer_statements
  for all using (is_admin()) with check (is_admin());

alter publication supabase_realtime add table customer_statements, test_customer_statements;

-- 'statement' becomes a valid email_imports document type.
alter table public.email_imports drop constraint if exists email_imports_document_type_check;
alter table public.email_imports add constraint email_imports_document_type_check
  check (document_type in ('invoice', 'credit_note', 'statement'));
alter table public.test_email_imports drop constraint if exists email_imports_document_type_check;
alter table public.test_email_imports drop constraint if exists test_email_imports_document_type_check;
alter table public.test_email_imports add constraint test_email_imports_document_type_check
  check (document_type in ('invoice', 'credit_note', 'statement'));

alter table public.email_imports add column if not exists statement_id text;
alter table public.test_email_imports add column if not exists statement_id text;
