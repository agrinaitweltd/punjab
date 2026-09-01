-- 24-hour reminder cooldown (item 2). Additive columns + a row-locking
-- reservation function so the cooldown is enforced server-side and stays
-- correct across concurrent admins, not just a disabled frontend button.
alter table public.invoices add column if not exists last_reminder_sent_at timestamptz;
alter table public.invoices add column if not exists last_reminder_stage text;
alter table public.invoices add column if not exists last_reminder_sent_by text;
alter table public.invoices add column if not exists last_reminder_recipient text;
alter table public.invoices add column if not exists last_reminder_provider_message_id text;

alter table public.test_invoices add column if not exists last_reminder_sent_at timestamptz;
alter table public.test_invoices add column if not exists last_reminder_stage text;
alter table public.test_invoices add column if not exists last_reminder_sent_by text;
alter table public.test_invoices add column if not exists last_reminder_recipient text;
alter table public.test_invoices add column if not exists last_reminder_provider_message_id text;

-- Atomically reserves the 24h reminder slot for one invoice: locks the row
-- (SELECT ... FOR UPDATE), checks whether the last send was within 24h, and
-- only if not, stamps last_reminder_sent_at = now() in the same
-- transaction. Returns reserved=false with the real next-allowed time if
-- the cooldown is still active, so two admins racing on the same invoice
-- can never both win. The caller (send-reminder.js) restores
-- last_reminder_sent_at to the previous value if the email send afterward
-- fails, so a failed attempt never starts the cooldown.
create or replace function public.reserve_invoice_reminder_slot(p_invoice_id text, p_stage text, p_sent_by text)
returns table(reserved boolean, next_allowed_at timestamptz, previous_sent_at timestamptz) as $$
declare
  v_previous timestamptz;
begin
  select i.last_reminder_sent_at into v_previous from public.invoices i where i.id = p_invoice_id for update;
  if not found then
    return query select false, null::timestamptz, null::timestamptz;
    return;
  end if;
  if v_previous is not null and v_previous > now() - interval '24 hours' then
    return query select false, v_previous + interval '24 hours', v_previous;
    return;
  end if;
  update public.invoices
    set last_reminder_sent_at = now(), last_reminder_stage = p_stage, last_reminder_sent_by = p_sent_by
    where id = p_invoice_id;
  return query select true, now() + interval '24 hours', v_previous;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.reserve_invoice_reminder_slot(text, text, text) from public;
grant execute on function public.reserve_invoice_reminder_slot(text, text, text) to service_role;
