-- Keep cash payments and credit allocations distinct, and apply credits atomically.

alter table public.credit_notes add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();
alter table public.test_credit_notes add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();

alter table public.credit_note_allocations drop constraint if exists credit_note_allocations_amount_check;
alter table public.credit_note_allocations add constraint credit_note_allocations_amount_check check (amount > 0);
alter table public.test_credit_note_allocations drop constraint if exists test_credit_note_allocations_amount_check;
alter table public.test_credit_note_allocations add constraint test_credit_note_allocations_amount_check check (amount > 0);

-- Older application code added credit allocations to amount_paid. Restore that
-- column to cash-only before future calculations use payments and credits separately.
with applied as (
  select invoice_id, sum(amount) amount from public.credit_note_allocations group by invoice_id
)
update public.invoices invoice
set amount_paid = greatest(0, coalesce(invoice.amount_paid, 0) - applied.amount)
from applied where applied.invoice_id = invoice.id;

with applied as (
  select invoice_id, sum(amount) amount from public.test_credit_note_allocations group by invoice_id
)
update public.test_invoices invoice
set amount_paid = greatest(0, coalesce(invoice.amount_paid, 0) - applied.amount)
from applied where applied.invoice_id = invoice.id;

create or replace function public.apply_credit_note_internal(
  p_credit_note_id text, p_invoice_id text, p_amount numeric, p_date date, p_test boolean
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  note_row record;
  invoice_row record;
  allocated numeric;
  outstanding numeric;
  new_remaining numeric;
  new_status text;
  note_table text := case when p_test then 'test_credit_notes' else 'credit_notes' end;
  invoice_table text := case when p_test then 'test_invoices' else 'invoices' end;
  allocation_table text := case when p_test then 'test_credit_note_allocations' else 'credit_note_allocations' end;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_amount is null or round(p_amount, 2) <= 0 then raise exception 'Credit amount must be greater than zero'; end if;

  execute format('select id, customer_id, amount, remaining_balance, status from public.%I where id = $1 for update', note_table)
    into note_row using p_credit_note_id;
  if note_row is null then raise exception 'Credit note not found'; end if;
  if note_row.status <> 'Active' then raise exception 'Only active credit notes can be allocated'; end if;

  execute format('select id, customer_id, amount, amount_paid from public.%I where id = $1 for update', invoice_table)
    into invoice_row using p_invoice_id;
  if invoice_row is null then raise exception 'Invoice not found'; end if;
  if note_row.customer_id is distinct from invoice_row.customer_id then raise exception 'Credit note and invoice belong to different customers'; end if;

  execute format('select coalesce(sum(amount), 0) from public.%I where invoice_id = $1', allocation_table)
    into allocated using p_invoice_id;
  outstanding := greatest(0, round(invoice_row.amount - coalesce(invoice_row.amount_paid, 0) - allocated, 2));
  if round(p_amount, 2) > round(note_row.remaining_balance, 2) then raise exception 'Credit amount exceeds the available credit'; end if;
  if round(p_amount, 2) > outstanding then raise exception 'Credit amount exceeds the invoice outstanding balance'; end if;

  execute format('insert into public.%I (id, credit_note_id, invoice_id, amount, date) values ($1,$2,$3,$4,$5)', allocation_table)
    using extensions.gen_random_uuid()::text, p_credit_note_id, p_invoice_id, round(p_amount, 2), coalesce(p_date, current_date);
  new_remaining := greatest(0, round(note_row.remaining_balance - p_amount, 2));
  execute format('update public.%I set remaining_balance = $1, linked_invoice_id = coalesce(linked_invoice_id, $2) where id = $3', note_table)
    using new_remaining, p_invoice_id, p_credit_note_id;

  outstanding := greatest(0, round(outstanding - p_amount, 2));
  new_status := case when outstanding <= 0 then 'Paid' when coalesce(invoice_row.amount_paid, 0) > 0 or allocated + p_amount > 0 then 'Part Paid' else 'Unpaid' end;
  execute format('update public.%I set status = $1 where id = $2', invoice_table) using new_status, p_invoice_id;
  return jsonb_build_object('appliedAmount', round(p_amount, 2), 'remainingCredit', new_remaining, 'outstanding', outstanding, 'invoiceStatus', new_status);
end
$$;

create or replace function public.apply_credit_note(p_credit_note_id text, p_invoice_id text, p_amount numeric, p_date date default current_date)
returns jsonb language sql security definer set search_path = '' as $$
  select public.apply_credit_note_internal(p_credit_note_id, p_invoice_id, p_amount, p_date, false)
$$;
create or replace function public.apply_test_credit_note(p_credit_note_id text, p_invoice_id text, p_amount numeric, p_date date default current_date)
returns jsonb language sql security definer set search_path = '' as $$
  select public.apply_credit_note_internal(p_credit_note_id, p_invoice_id, p_amount, p_date, true)
$$;

revoke all on function public.apply_credit_note_internal(text,text,numeric,date,boolean) from public;
revoke all on function public.apply_credit_note(text,text,numeric,date) from public;
revoke all on function public.apply_test_credit_note(text,text,numeric,date) from public;
grant execute on function public.apply_credit_note(text,text,numeric,date) to authenticated, service_role;
grant execute on function public.apply_test_credit_note(text,text,numeric,date) to authenticated, service_role;

alter table public.credit_note_allocations enable row level security;
drop policy if exists credit_note_allocations_customer_select on public.credit_note_allocations;
create policy credit_note_allocations_customer_select on public.credit_note_allocations for select to authenticated
using (
  public.is_admin() or exists (
    select 1 from public.credit_notes note
    where note.id = credit_note_id and note.customer_id in (select public.current_customer_ids())
  )
);
