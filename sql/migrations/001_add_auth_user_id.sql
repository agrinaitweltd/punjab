-- ============================================================
-- Migration 001 — link existing accounts to real Supabase Auth users
-- ============================================================
-- SAFE / ADDITIVE ONLY:
--   * Adds nullable columns — does not touch any existing column, row, or value.
--   * Does not drop, rename, or truncate anything.
--   * Does not enable RLS (that's a later, separate migration run only after
--     login has been cut over to real Supabase Auth — see sql/migrations/002).
--   * Fully reversible: `alter table ... drop column auth_user_id;` undoes it
--     cleanly since nothing else depends on the column yet.
--
-- HOW TO RUN:
--   Supabase Dashboard → your project → SQL Editor → New query → paste → Run.
--   (Same place you originally ran src/lib/schema.sql.)
-- ============================================================

alter table admin_staff add column if not exists auth_user_id uuid unique references auth.users(id);
alter table customers   add column if not exists auth_user_id uuid unique references auth.users(id);

create index if not exists idx_admin_staff_auth_user_id on admin_staff(auth_user_id);
create index if not exists idx_customers_auth_user_id   on customers(auth_user_id);

-- customer_sub_accounts does not exist in this project yet (schema drift from
-- src/lib/schema.sql — confirmed via live check). If/when it's created, add:
--   alter table customer_sub_accounts add column if not exists auth_user_id uuid unique references auth.users(id);
