-- ============================================================
-- Punjab Exotic Foods Ltd — Supabase Database Schema
-- ============================================================
-- HOW TO ACTIVATE:
-- 1. Go to https://supabase.com/dashboard
-- 2. Open your project: vqnnlorukpzsftfisjrm
-- 3. Click "SQL Editor" in the left sidebar
-- 4. Click "New query"
-- 5. Paste ALL of this file and click "Run"
-- 6. Done! Your app will now read/write real data.
-- ============================================================

-- ADMIN STAFF
create table if not exists admin_staff (
  id             text primary key default gen_random_uuid()::text,
  name           text not null,
  username       text unique not null,
  email          text unique not null,
  password       text not null,
  phone          text,
  role           text not null default 'Staff',
  active         boolean not null default true,
  is_super_admin boolean not null default false,
  permissions    jsonb not null default '{}'::jsonb,
  created_at     timestamptz default now()
);

-- Seed owner login (username: admin  password: admin123)
insert into admin_staff (id, name, username, email, password, role, active, is_super_admin, permissions)
values (
  'adm-owner',
  'Owner Admin',
  'admin',
  'admin@punjabfoods.co.uk',
  'admin123',
  'Owner',
  true,
  true,
  '{"customers":true,"prices":true,"stock":true,"orders":true,"enquiries":true,"tickets":true,"payments":true,"complaints":true,"extracts":true,"stats":true,"admins":true,"products":true}'::jsonb
) on conflict (username) do nothing;

-- CUSTOMERS
create table if not exists customers (
  id              text primary key default gen_random_uuid()::text,
  company_name    text not null,
  contact_person  text,
  email           text,
  phone           text,
  customer_number text unique not null,
  username        text,
  password        text not null,
  address         text,
  delivery_area   text,
  payment_terms   text default 'Payment Before Order',
  balance         numeric(10,2) default 0,
  status          text default 'active',
  last_activity   timestamptz default now(),
  created_at      timestamptz default now()
);

-- PRODUCTS
create table if not exists products (
  id               text primary key default gen_random_uuid()::text,
  product_name     text not null,
  category         text,
  variety          text,
  size             text,
  sku              text unique not null,
  boxes_per_pallet integer default 0,
  product_image    text,
  created_at       timestamptz default now()
);

-- STOCK ITEMS
create table if not exists stock_items (
  id                 text primary key default gen_random_uuid()::text,
  product_id         text references products(id) on delete cascade,
  available_quantity integer default 0,
  price              numeric(10,2) default 0,
  last_updated       text,
  status             text default 'available',
  created_at         timestamptz default now()
);

-- ORDERS
create table if not exists orders (
  id            text primary key default gen_random_uuid()::text,
  order_number  text unique not null,
  customer_id   text references customers(id) on delete set null,
  customer_name text,
  date          date default current_date,
  amount        numeric(10,2) default 0,
  status        text default 'Pending',
  items         jsonb default '[]'::jsonb,
  created_at    timestamptz default now()
);

-- INVOICES
create table if not exists invoices (
  id              text primary key default gen_random_uuid()::text,
  customer_id     text references customers(id) on delete cascade,
  invoice_number  text unique not null,
  amount          numeric(10,2) default 0,
  due_date        date,
  status          text default 'Unpaid',
  created_at      timestamptz default now()
);

-- PAYMENTS
create table if not exists payments (
  id                 text primary key default gen_random_uuid()::text,
  customer_id        text references customers(id) on delete cascade,
  payment_reference  text unique not null,
  amount             numeric(10,2) default 0,
  date               date default current_date,
  method             text default 'Bank Transfer',
  created_at         timestamptz default now()
);

-- SUPPORT TICKETS
create table if not exists support_tickets (
  id              text primary key default gen_random_uuid()::text,
  created_by_role text,
  customer_id     text references customers(id) on delete set null,
  subject         text not null,
  message         text,
  status          text default 'Open',
  created_at      text default to_char(now(), 'YYYY-MM-DD HH24:MI')
);

-- DELIVERY AREAS
create table if not exists delivery_areas (
  id                text primary key default gen_random_uuid()::text,
  name              text unique not null,
  charge_per_pallet numeric(10,2) default 0,
  created_at        timestamptz default now()
);

insert into delivery_areas (id, name, charge_per_pallet) values
  ('d-1', 'Birmingham', 65),
  ('d-2', 'London',     85),
  ('d-3', 'Manchester', 75),
  ('d-4', 'Leeds',      70),
  ('d-5', 'Leicester',  65)
on conflict (name) do nothing;

-- ACTIVITY LOG
create table if not exists activity_log (
  id            text primary key default gen_random_uuid()::text,
  customer_name text,
  action        text,
  timestamp     text default to_char(now(), 'YYYY-MM-DD HH24:MI'),
  created_at    timestamptz default now()
);

-- DISABLE ROW LEVEL SECURITY (enable later when adding Supabase Auth)
alter table admin_staff     disable row level security;
alter table customers       disable row level security;
alter table products        disable row level security;
alter table stock_items     disable row level security;
alter table orders          disable row level security;
alter table invoices        disable row level security;
alter table payments        disable row level security;
alter table support_tickets disable row level security;
alter table delivery_areas  disable row level security;
alter table activity_log    disable row level security;