-- Tracks whether an email import created a brand-new customer (vs matching
-- an existing one), so the Email Imports page can show "New Customer
-- Created" / "Added to Existing Customer" instead of a single generic
-- "Imported" for every success.

alter table public.email_imports add column if not exists customer_created boolean not null default false;
alter table public.test_email_imports add column if not exists customer_created boolean not null default false;
