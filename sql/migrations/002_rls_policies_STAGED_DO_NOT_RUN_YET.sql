-- ============================================================
-- Migration 002 — Row Level Security policies (STAGED — DO NOT RUN YET)
-- ============================================================
-- DO NOT run this until:
--   1. The one existing admin account (contact@punjabexoticfoods.co.uk) has
--      completed the password-set flow (sql/migrations/001 + the
--      backfill/recovery-link work already done) and confirmed they can log
--      in via real Supabase Auth.
--   2. Any future customer accounts get the same auth_user_id + recovery-link
--      treatment at creation/approval time (see note at the bottom — the
--      customer-approval flow needs a small addition for this).
--
-- WHY: every current read in this app goes through the browser's Supabase
-- client using the anon key. Almost none of those requests carry a real
-- Supabase Auth session today (login is still the legacy password check for
-- everyone except an admin who has completed the reset flow above) — so
-- auth.uid() is NULL for nearly all current traffic. Turning RLS on before
-- that changes means every policy below (all of which require a matching
-- auth.uid()) would deny every request app-wide, for every user, immediately.
-- That is the exact "logs everyone out of a live business app" scenario we
-- are avoiding. Apply this only after verifying real sessions are in place.
--
-- REVERSIBLE: `alter table X disable row level security;` per table
-- immediately restores today's (open) behavior if anything goes wrong.
-- ============================================================

-- ── Helper: is the current request from an admin? ──
-- app_metadata is set on the auth.users row by scripts/backfill-auth-users.mjs
-- (and should be set the same way for any admin created going forward) and is
-- included in the JWT Supabase issues, so this needs no extra table lookup.
create or replace function is_admin() returns boolean
language sql stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

create or replace function public.current_customer_ids() returns setof text
language sql stable security definer
set search_path = ''
as $$
  select id from public.customers where auth_user_id = auth.uid()
  union
  select customer_id from public.customer_sub_accounts
  where auth_user_id = auth.uid() and active and status = 'Approved'
$$;

-- ── customers — each customer sees only their own row; admins see all ──
alter table customers enable row level security;
create policy "customers_select_own_or_admin" on customers for select
  using (is_admin() or id in (select public.current_customer_ids()));
create policy "customers_update_own_or_admin" on customers for update
  using (is_admin() or id in (select public.current_customer_ids()));
create policy "customers_admin_write" on customers for insert with check (is_admin());
create policy "customers_admin_delete" on customers for delete using (is_admin());

alter table customer_sub_accounts enable row level security;
create policy "customer_sub_accounts_select" on customer_sub_accounts for select using (
  is_admin() or auth_user_id = auth.uid() or customer_id in (select public.current_customer_ids())
);
create policy "customer_sub_accounts_customer_insert" on customer_sub_accounts for insert with check (
  is_admin() or customer_id in (select public.current_customer_ids())
);
create policy "customer_sub_accounts_update" on customer_sub_accounts for update using (
  is_admin() or auth_user_id = auth.uid() or customer_id in (select public.current_customer_ids())
);
create policy "customer_sub_accounts_admin_delete" on customer_sub_accounts for delete using (is_admin());

-- ── admin_staff — admins only (nobody should browse the staff roster except staff) ──
alter table admin_staff enable row level security;
create policy "admin_staff_admin_only" on admin_staff for all
  using (is_admin() or auth_user_id = auth.uid())
  with check (is_admin());

-- ── orders / invoices / payments / credit_notes / notification_logs / support_tickets
--    — each has a customer_id FK; a customer sees only rows for their own account ──
alter table orders enable row level security;
create policy "orders_select" on orders for select using (
  is_admin() or customer_id in (select public.current_customer_ids())
);
create policy "orders_admin_write" on orders for insert with check (is_admin());
create policy "orders_admin_update" on orders for update using (is_admin());
create policy "orders_admin_delete" on orders for delete using (is_admin());

alter table invoices enable row level security;
create policy "invoices_select" on invoices for select using (
  is_admin() or customer_id in (select public.current_customer_ids())
);
create policy "invoices_admin_write" on invoices for all using (is_admin()) with check (is_admin());

alter table payments enable row level security;
create policy "payments_select" on payments for select using (
  is_admin() or customer_id in (select public.current_customer_ids())
);
create policy "payments_admin_write" on payments for all using (is_admin()) with check (is_admin());

alter table credit_notes enable row level security;
create policy "credit_notes_select" on credit_notes for select using (
  is_admin() or customer_id in (select public.current_customer_ids())
);
create policy "credit_notes_admin_write" on credit_notes for all using (is_admin()) with check (is_admin());

alter table credit_note_allocations enable row level security;
create policy "credit_note_allocations_admin_only" on credit_note_allocations for all
  using (is_admin()) with check (is_admin());

alter table notification_logs enable row level security;
create policy "notification_logs_admin_only" on notification_logs for all
  using (is_admin()) with check (is_admin());

alter table support_tickets enable row level security;
create policy "support_tickets_select" on support_tickets for select using (
  is_admin() or customer_id in (select public.current_customer_ids())
);
create policy "support_tickets_insert" on support_tickets for insert with check (
  is_admin() or customer_id in (select public.current_customer_ids())
);
create policy "support_tickets_admin_update" on support_tickets for update using (is_admin());
create policy "support_tickets_admin_delete" on support_tickets for delete using (is_admin());

-- ── products / stock_items / delivery_areas — shared catalog data.
--    Any signed-in user (admin or customer) can read; only admins write. ──
alter table products enable row level security;
create policy "products_select_authenticated" on products for select using (auth.uid() is not null or is_admin());
create policy "products_admin_write" on products for all using (is_admin()) with check (is_admin());

alter table stock_items enable row level security;
create policy "stock_items_select_authenticated" on stock_items for select using (auth.uid() is not null or is_admin());
create policy "stock_items_admin_write" on stock_items for all using (is_admin()) with check (is_admin());

alter table delivery_areas enable row level security;
create policy "delivery_areas_select_authenticated" on delivery_areas for select using (auth.uid() is not null or is_admin());
create policy "delivery_areas_admin_write" on delivery_areas for all using (is_admin()) with check (is_admin());

-- ── internal/operational tables — admin only, no customer access at all ──
alter table admin_roles enable row level security;
create policy "admin_roles_admin_only" on admin_roles for all using (is_admin()) with check (is_admin());

alter table suppliers enable row level security;
create policy "suppliers_admin_only" on suppliers for all using (is_admin()) with check (is_admin());

alter table buying_sessions enable row level security;
create policy "buying_sessions_admin_only" on buying_sessions for all using (is_admin()) with check (is_admin());

alter table buying_prices enable row level security;
create policy "buying_prices_admin_only" on buying_prices for all using (is_admin()) with check (is_admin());

alter table day_trades enable row level security;
create policy "day_trades_admin_only" on day_trades for all using (is_admin()) with check (is_admin());

alter table activity_log enable row level security;
create policy "activity_log_admin_only" on activity_log for all using (is_admin()) with check (is_admin());

alter table salesmen enable row level security;
create policy "salesmen_admin_only" on salesmen for all using (is_admin()) with check (is_admin());

alter table assigned_tasks enable row level security;
create policy "assigned_tasks_admin_only" on assigned_tasks for all using (is_admin()) with check (is_admin());

alter table whatsapp_logs enable row level security;
create policy "whatsapp_logs_admin_only" on whatsapp_logs for all using (is_admin()) with check (is_admin());

alter table whatsapp_templates enable row level security;
create policy "whatsapp_templates_admin_only" on whatsapp_templates for all using (is_admin()) with check (is_admin());

-- customer_applications: public submission form writes here (unauthenticated
-- "Apply for an account"), but only admins should ever read the list.
alter table customer_applications enable row level security;
create policy "customer_applications_public_insert" on customer_applications for insert with check (true);
create policy "customer_applications_admin_read" on customer_applications for select using (is_admin());
create policy "customer_applications_admin_write" on customer_applications for update using (is_admin());
create policy "customer_applications_admin_delete" on customer_applications for delete using (is_admin());

-- customer_sub_accounts does not exist in this project yet — if/when it is
-- created, mirror the `customers` policies above, scoped through customer_id.

-- ============================================================
-- NOTE — going forward, customer creation/approval needs one addition:
-- when an admin approves a customer_application into a real `customers` row
-- (or creates one directly), also call supabase.auth.admin.createUser +
-- generateLink (same pattern as scripts/backfill-auth-users.mjs) and email
-- them the recovery link, so they have a real auth_user_id from day one
-- instead of relying on the legacy password path. Otherwise, once RLS is
-- on, a customer without a linked auth_user_id can never satisfy
-- "auth_user_id = auth.uid()" and will be unable to log in at all.
-- ============================================================
