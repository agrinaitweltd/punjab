-- Real notification feed (bell icon), replacing the old "just a count of new
-- orders/tickets" placeholder. Any active admin (not just System Developer)
-- can read/write these - notifications are informational, not sensitive.
create table if not exists public.notifications (
  id text primary key default gen_random_uuid()::text,
  type text not null,
  title text not null,
  message text,
  target_type text, -- 'customer' | 'invoice' | 'payment' | 'credit_note' | 'email_import' | 'system'
  target_id text,
  read boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_created_at on public.notifications (created_at desc);
create index if not exists idx_notifications_unread on public.notifications (read) where not read;

alter table public.notifications enable row level security;
create policy "notifications_admin_all" on public.notifications for all
  using (is_admin()) with check (is_admin());

create table if not exists public.test_notifications (like public.notifications including all);
alter table public.test_notifications enable row level security;
create policy "test_notifications_admin_all" on public.test_notifications for all
  using (is_admin()) with check (is_admin());

alter publication supabase_realtime add table notifications, test_notifications;
