-- Tracks the nightly 9pm Europe/London health check so it only actually
-- runs once per UK-local day, even though the underlying Vercel cron fires
-- hourly (Vercel cron is UTC-only with no DST awareness - the function
-- itself checks the current Europe/London wall-clock hour and no-ops unless
-- it's 21:00 there, GMT or BST as applicable).
create table if not exists public.health_check_runs (
  id text primary key, -- UK-local date, e.g. '2026-08-27'
  ran_at timestamptz not null default now(),
  summary jsonb not null default '{}'::jsonb
);
alter table public.health_check_runs enable row level security;
create policy "health_check_runs_admin_read" on public.health_check_runs for select using (is_admin());
