-- src/lib/schema.sql has documented is_salesman/salesman_ids on admin_staff
-- since the salesman-linking feature was added to the Admins page, but that
-- ALTER was never run against the already-live database. invite-admin.js
-- unconditionally inserts both columns, so every "Invite Admin" attempt in
-- production has been failing with a Postgres schema-cache error. Purely
-- additive - no existing data touched.

alter table admin_staff add column if not exists is_salesman boolean default false;
alter table admin_staff add column if not exists salesman_ids jsonb default '[]'::jsonb;
