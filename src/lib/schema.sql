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
  job_title      text,
  active         boolean not null default true,
  is_super_admin boolean not null default false,
  permissions    jsonb not null default '{}'::jsonb,
  created_at     timestamptz default now()
);

-- If admin_staff already existed before this column was added, run:
-- alter table admin_staff add column if not exists job_title text;

-- ADMIN ROLES — named permission templates the admin picker can apply to a
-- staff account. The account's own `permissions` column (above) remains the
-- single source of truth checked at runtime; these rows are just reusable
-- starting points, so editing a template later doesn't retroactively change
-- anyone already using it.
create table if not exists admin_roles (
  id          text primary key default gen_random_uuid()::text,
  name        text unique not null,
  description text,
  permissions jsonb not null default '{}'::jsonb,
  is_system   boolean not null default false,
  created_at  timestamptz default now()
);

insert into admin_roles (id, name, description, permissions, is_system) values
  ('role-super-admin', 'Super Admin', 'Full access to every module and action.',
    '{"customers":true,"prices":true,"stock":true,"orders":true,"enquiries":true,"tickets":true,"payments":true,"complaints":true,"extracts":true,"stats":true,"admins":true,"products":true,"customersCreate":true,"customersDelete":true,"invoicesDelete":true,"paymentsRecord":true,"paymentsDelete":true,"paymentsAllocate":true,"buyingPricesEdit":true,"creditNotesIssue":true,"applicationsManage":true,"usersManage":true}'::jsonb,
    true),
  ('role-salesperson', 'Salesperson', 'Can create customer applications and accounts, and view products/prices. Cannot delete invoices/payments or manage users.',
    '{"customers":true,"products":true,"prices":true,"orders":true,"customersCreate":true,"applicationsManage":true}'::jsonb,
    true),
  ('role-cashier', 'Cashier', 'Records payments, views balances/statements, allocates payments. Cannot edit buying prices or delete customers.',
    '{"customers":true,"payments":true,"stats":true,"paymentsRecord":true,"paymentsAllocate":true}'::jsonb,
    true)
on conflict (name) do nothing;

alter table admin_roles disable row level security;

-- Seed owner login (email: info@punjabexoticfoods.com  password: admin123)
insert into admin_staff (id, name, username, email, password, role, job_title, active, is_super_admin, permissions)
values (
  'adm-owner',
  'Punjab Exotic Foods',
  'admin',
  'info@punjabexoticfoods.com',
  'admin123',
  'Owner',
  'Owner',
  true,
  true,
  '{"customers":true,"prices":true,"stock":true,"orders":true,"enquiries":true,"tickets":true,"payments":true,"complaints":true,"extracts":true,"stats":true,"admins":true,"products":true,"customersCreate":true,"customersDelete":true,"invoicesDelete":true,"paymentsRecord":true,"paymentsDelete":true,"paymentsAllocate":true,"buyingPricesEdit":true,"creditNotesIssue":true,"applicationsManage":true,"usersManage":true}'::jsonb
) on conflict (id) do nothing;

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
  credit_limit    numeric(10,2) default 0,
  credit_days     integer default 14,
  blocked         boolean default false,
  vat_number        text,
  registered_address text,
  notes             text,
  last_activity   timestamptz default now(),
  created_at      timestamptz default now()
);

-- If the customers table already existed before these columns were added, run:
-- alter table customers add column if not exists credit_limit numeric(10,2) default 0;
-- alter table customers add column if not exists credit_days integer default 14;
-- alter table customers add column if not exists blocked boolean default false;
-- alter table customers add column if not exists vat_number text;
-- alter table customers add column if not exists registered_address text;
-- alter table customers add column if not exists notes text;

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
  fulfilment    text default 'Delivery' check (fulfilment in ('Delivery', 'Collection')),
  delivery_address text,
  created_at    timestamptz default now()
);

-- If the orders table already existed before these columns were added, run:
-- alter table orders add column if not exists fulfilment text default 'Delivery' check (fulfilment in ('Delivery', 'Collection'));
-- alter table orders add column if not exists delivery_address text;

-- INVOICES
create table if not exists invoices (
  id              text primary key default gen_random_uuid()::text,
  customer_id     text references customers(id) on delete cascade,
  invoice_number  text unique not null,
  amount          numeric(10,2) default 0,
  due_date        date,
  date            date,
  status          text default 'Unpaid',
  amount_paid     numeric(10,2) default 0,
  created_at      timestamptz default now()
);

-- If the invoices table already existed before these columns were added, run:
-- alter table invoices add column if not exists date date;
-- alter table invoices add column if not exists amount_paid numeric(10,2) default 0;

-- PAYMENTS
create table if not exists payments (
  id                 text primary key default gen_random_uuid()::text,
  customer_id        text references customers(id) on delete cascade,
  payment_reference  text unique not null,
  amount             numeric(10,2) default 0,
  date               date default current_date,
  method             text default 'Bank Transfer',
  invoice_id         text references invoices(id) on delete set null,
  created_at         timestamptz default now()
);

-- If the payments table already existed before this column was added, run:
-- alter table payments add column if not exists invoice_id text references invoices(id) on delete set null;

-- CREDIT NOTES — issued either against a specific invoice (Option A, reduces
-- that invoice's balance immediately) or as a standalone account credit
-- (Option B, linked_invoice_id is null) that sits on the account until
-- applied to a future invoice.
create table if not exists credit_notes (
  id                text primary key default gen_random_uuid()::text,
  credit_number     text unique not null,
  customer_id       text references customers(id) on delete cascade,
  amount            numeric(10,2) not null default 0,
  reason            text,
  date              date default current_date,
  linked_ticket_id  text references support_tickets(id) on delete set null,
  linked_invoice_id text references invoices(id) on delete set null,
  status            text not null default 'Active' check (status in ('Active', 'Void')),
  remaining_balance numeric(10,2) not null default 0,
  created_at        timestamptz default now()
);

-- CREDIT NOTE ALLOCATIONS — an auditable record of each time some of a
-- credit note's balance was applied against an invoice.
create table if not exists credit_note_allocations (
  id              text primary key default gen_random_uuid()::text,
  credit_note_id  text references credit_notes(id) on delete cascade,
  invoice_id      text references invoices(id) on delete cascade,
  amount          numeric(10,2) not null default 0,
  date            date default current_date,
  created_at      timestamptz default now()
);

alter table credit_notes disable row level security;
alter table credit_note_allocations disable row level security;

-- CUSTOMER APPLICATIONS — public "Apply For An Account" submissions.
-- These do NOT create a customer login; an admin must approve them first.
create table if not exists customer_applications (
  id                  text primary key default gen_random_uuid()::text,
  company_name        text not null,
  contact_name        text not null,
  email               text not null,
  phone               text,
  registered_address  text,
  status              text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  notes               text,
  date                date default current_date,
  created_at          timestamptz default now()
);
alter table customer_applications disable row level security;

-- PRODUCE BUYING DESK — replaces the old client-side-only Daily Session.
-- One buying_sessions row per calendar buying date; buying_prices holds
-- every supplier quotation entered that day (confirmed = true once the
-- order is placed with that supplier).
create table if not exists buying_sessions (
  id            text primary key default gen_random_uuid()::text,
  date          date unique not null,
  status        text not null default 'Open' check (status in ('Open', 'Closed')),
  published_at  timestamptz,
  created_at    timestamptz default now()
);
alter table buying_sessions disable row level security;

create table if not exists buying_prices (
  id          text primary key default gen_random_uuid()::text,
  session_id  text references buying_sessions(id) on delete cascade,
  date        date not null,
  supplier    text not null,
  product     text not null,
  variety     text,
  brand       text,
  size        text,
  unit        text,
  price       numeric(10,2) not null default 0,
  quantity    numeric(10,2) not null default 0,
  notes       text,
  confirmed   boolean not null default false,
  created_at  timestamptz default now()
);
alter table buying_prices disable row level security;

-- PAYMENT REMINDER NOTIFICATIONS — one row per send attempt (email now;
-- whatsapp is stubbed until a WhatsApp Business/Twilio account is connected).
create table if not exists notification_logs (
  id             text primary key default gen_random_uuid()::text,
  invoice_id     text references invoices(id) on delete cascade,
  customer_id    text references customers(id) on delete cascade,
  channel        text not null check (channel in ('email', 'whatsapp')),
  status         text not null check (status in ('Sent', 'Failed', 'Scheduled')),
  scheduled_for  timestamptz,
  sent_at        timestamptz,
  error          text,
  created_at     timestamptz default now()
);
alter table notification_logs disable row level security;

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
  ('d-1',  'Greater London',    85),
  ('d-2',  'Essex',             80),
  ('d-3',  'Kent',              80),
  ('d-4',  'Surrey',            80),
  ('d-5',  'Hertfordshire',     78),
  ('d-6',  'Buckinghamshire',   78),
  ('d-7',  'Berkshire',         78),
  ('d-8',  'Oxfordshire',       78),
  ('d-9',  'Cambridgeshire',    78),
  ('d-10', 'Bedfordshire',      75),
  ('d-11', 'Northamptonshire',  75),
  ('d-12', 'Birmingham',        65),
  ('d-13', 'Manchester',        75),
  ('d-14', 'Liverpool',         75),
  ('d-15', 'Leeds',             70),
  ('d-16', 'Sheffield',         70),
  ('d-17', 'Nottingham',        68),
  ('d-18', 'Leicester',         65),
  ('d-19', 'Bristol',           75),
  ('d-20', 'Cardiff',           82),
  ('d-21', 'Edinburgh',         95),
  ('d-22', 'Glasgow',           95),
  ('d-23', 'Newcastle',         85),
  ('d-24', 'Southampton',       78),
  ('d-25', 'Portsmouth',        78),
  ('d-26', 'Brighton',          80),
  ('d-27', 'Milton Keynes',     75),
  ('d-28', 'Coventry',          68),
  ('d-29', 'Wolverhampton',     68),
  ('d-30', 'Reading',           78),
  ('d-31', 'Slough',            78),
  ('d-32', 'Luton',             75)
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