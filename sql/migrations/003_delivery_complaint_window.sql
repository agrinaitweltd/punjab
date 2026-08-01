-- ============================================================
-- Migration 003 — delivery confirmation / 20-hour complaint window
-- ============================================================
-- SAFE / ADDITIVE ONLY: new nullable columns on `orders`, nothing dropped,
-- nothing renamed, no existing row touched. Reversible with
-- `alter table orders drop column ...` if ever needed.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste → Run.
-- ============================================================

alter table orders add column if not exists delivered_at timestamptz;
alter table orders add column if not exists delivery_confirmation text check (delivery_confirmation in ('ok', 'issue'));
alter table orders add column if not exists delivery_confirmed_at timestamptz;
