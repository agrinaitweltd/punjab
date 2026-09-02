-- Tracks whether an admin has completed (or skipped) the first-time guided
-- tour, so it auto-starts once on first login and never again after that -
-- they can replay it manually from Settings without this changing.
alter table public.admin_staff add column if not exists tutorial_completed_at timestamptz;
