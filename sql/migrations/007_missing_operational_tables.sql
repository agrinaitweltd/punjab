-- Add operational tables referenced by the application but missing from the
-- original live schema. No existing table or row is changed or removed.
create table if not exists public.salesmen (
  id text primary key default gen_random_uuid()::text,
  number text unique not null,
  username text unique not null,
  name text not null,
  code text not null,
  created_at timestamptz default now()
);

create table if not exists public.assigned_tasks (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  description text,
  assigned_to_id text,
  assigned_to_name text,
  assigned_by_name text,
  status text not null default 'Open' check (status in ('Open', 'Done')),
  created_at timestamptz default now()
);

create table if not exists public.customer_sub_accounts (
  id text primary key default gen_random_uuid()::text,
  customer_id text references public.customers(id) on delete cascade,
  customer_name text,
  name text not null,
  email text not null,
  password text not null,
  permissions jsonb not null default '{}'::jsonb,
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  active boolean not null default true,
  created_at timestamptz default now(),
  auth_user_id uuid unique references auth.users(id)
);
create index if not exists customer_sub_accounts_customer_id_idx on public.customer_sub_accounts(customer_id);
create index if not exists customer_sub_accounts_auth_user_id_idx on public.customer_sub_accounts(auth_user_id);
