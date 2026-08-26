-- Server-side aggregation for the redesigned dashboard - one round trip
-- returns every card/chart's data for a given date range, instead of
-- fetching every invoice/payment/credit-note row into the browser and
-- aggregating client-side (item 7 of the dashboard-redesign request).
-- SECURITY DEFINER so it can aggregate across all rows regardless of the
-- caller's own row-level grants, but gated by is_admin() itself - only
-- admins can call it, same authorization the tables' own RLS already
-- enforces for direct reads.
create or replace function public.get_dashboard_analytics(
  p_start date,
  p_end date,
  p_bucket text default 'day',
  p_test boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $func$
declare
  result jsonb;
  customers_t text := case when p_test then 'test_customers' else 'customers' end;
  invoices_t text := case when p_test then 'test_invoices' else 'invoices' end;
  invoice_items_t text := case when p_test then 'test_invoice_items' else 'invoice_items' end;
  credit_notes_t text := case when p_test then 'test_credit_notes' else 'credit_notes' end;
  credit_note_items_t text := case when p_test then 'test_credit_note_items' else 'credit_note_items' end;
  payments_t text := case when p_test then 'test_payments' else 'payments' end;
  activity_t text := case when p_test then 'test_activity_log' else 'activity_log' end;
  bucket_fmt text := case p_bucket when 'month' then 'YYYY-MM' when 'week' then 'IYYY-"W"IW' else 'YYYY-MM-DD' end;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_bucket not in ('day', 'week', 'month') then
    raise exception 'Invalid bucket' using errcode = '22023';
  end if;

  execute format($q$
    with
    inv as (select * from %I where date >= $1 and date <= $2),
    pay as (select * from %I where date >= $1 and date <= $2),
    cn as (select * from %I where date >= $1 and date <= $2),
    inv_items as (select ii.* from %I ii join inv i on i.id = ii.invoice_id),
    cn_items as (select ci.* from %I ci join cn c on c.id = ci.credit_note_id),
    all_invoices as (select * from %I),
    all_customers as (select * from %I),
    summary as (
      select jsonb_build_object(
        'totalCustomers', (select count(*) from all_customers where coalesce(archived, false) = false),
        'totalInvoiceValue', coalesce((select sum(amount) from inv), 0),
        'paymentsReceived', coalesce((select sum(amount) from pay), 0),
        'outstanding', coalesce((select sum(greatest(0, amount - coalesce(amount_paid, 0))) from all_invoices where status <> 'Paid'), 0),
        'paidInvoices', (select count(*) from all_invoices where status = 'Paid'),
        'openInvoices', (select count(*) from all_invoices where status <> 'Paid'),
        'overdueInvoices', (select count(*) from all_invoices where status <> 'Paid' and due_date < current_date),
        'creditNotesValue', coalesce((select sum(amount) from cn), 0),
        'creditNotesCount', (select count(*) from cn),
        'documentsImportedToday', (select count(*) from %I where customer_name like 'FILE:%%' and created_at >= current_date)
      ) as data
    ),
    top_products as (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) as data from (
        select product, sum(quantity) as qty, sum(goods_value) as value
        from inv_items where product is not null and product <> ''
        group by product order by value desc limit 10
      ) t
    ),
    top_customers as (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) as data from (
        select c.id as "customerId", c.company_name as name,
          coalesce(sum(i.amount), 0) as "totalInvoiced",
          coalesce(sum(i.amount_paid), 0) as "totalPaid",
          coalesce(sum(greatest(0, i.amount - coalesce(i.amount_paid, 0))) filter (where i.status <> 'Paid'), 0) as outstanding,
          count(i.id) as "invoiceCount"
        from all_customers c join inv i on i.customer_id = c.id
        group by c.id, c.company_name order by "totalInvoiced" desc limit 10
      ) t
    ),
    sales_over_time as (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) as data from (
        select to_char(date, %L) as period, sum(amount) as value from inv group by period order by period
      ) t
    ),
    payments_over_time as (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) as data from (
        select to_char(date, %L) as period, sum(amount) as value from pay group by period order by period
      ) t
    ),
    credit_notes_over_time as (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) as data from (
        select to_char(date, %L) as period, sum(amount) as value from cn group by period order by period
      ) t
    ),
    customer_growth as (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) as data from (
        select to_char(created_at, %L) as period, count(*) as value
        from all_customers where created_at::date >= $1 and created_at::date <= $2
        group by period order by period
      ) t
    ),
    credit_notes_by_customer as (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) as data from (
        select c.id as "customerId", c.company_name as name, sum(cn2.amount) as value
        from all_customers c join cn cn2 on cn2.customer_id = c.id
        group by c.id, c.company_name order by value desc limit 10
      ) t
    ),
    credited_products as (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) as data from (
        select product, sum(quantity) as qty, sum(goods_value) as value
        from cn_items where product is not null and product <> ''
        group by product order by value desc limit 10
      ) t
    )
    select jsonb_build_object(
      'summary', (select data from summary),
      'topProducts', (select data from top_products),
      'topCustomers', (select data from top_customers),
      'salesOverTime', (select data from sales_over_time),
      'paymentsOverTime', (select data from payments_over_time),
      'creditNotesOverTime', (select data from credit_notes_over_time),
      'customerGrowth', (select data from customer_growth),
      'creditNotesByCustomer', (select data from credit_notes_by_customer),
      'creditedProducts', (select data from credited_products)
    )
  $q$, invoices_t, payments_t, credit_notes_t, invoice_items_t, credit_note_items_t, invoices_t, customers_t, activity_t, bucket_fmt, bucket_fmt, bucket_fmt, bucket_fmt)
  into result
  using p_start, p_end;

  return result;
end;
$func$;

grant execute on function public.get_dashboard_analytics(date, date, text, boolean) to authenticated;

-- Supporting indexes for the date-range filters and aggregations above -
-- item 7's "proper database indexes" - the app already has broad indexes
-- from migration 018, these are the ones specific to this function's
-- filter/join/group-by columns not already covered.
create index if not exists idx_invoices_date on public.invoices (date);
create index if not exists idx_payments_date on public.payments (date);
create index if not exists idx_credit_notes_date on public.credit_notes (date);
create index if not exists idx_invoice_items_invoice_id_product on public.invoice_items (invoice_id, product);
create index if not exists idx_credit_note_items_credit_note_id_product on public.credit_note_items (credit_note_id, product);
create index if not exists idx_customers_created_at on public.customers (created_at);
create index if not exists idx_test_invoices_date on public.test_invoices (date);
create index if not exists idx_test_payments_date on public.test_payments (date);
create index if not exists idx_test_credit_notes_date on public.test_credit_notes (date);
