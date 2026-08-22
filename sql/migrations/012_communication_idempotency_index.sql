-- A normal unique index still permits multiple null values and can be targeted by PostgREST upserts.
drop index if exists public.communication_logs_idempotency_key_uidx;
create unique index communication_logs_idempotency_key_uidx on public.communication_logs(idempotency_key);
