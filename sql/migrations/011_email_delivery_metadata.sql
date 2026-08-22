-- Additive metadata for sender routing, provider tracing and safe retries.
alter table public.communication_logs add column if not exists sender_category text;
alter table public.communication_logs add column if not exists sender_email text;
alter table public.communication_logs add column if not exists reply_to text;
alter table public.communication_logs add column if not exists subject text;
alter table public.communication_logs add column if not exists provider_message_id text;
alter table public.communication_logs add column if not exists last_attempt_at timestamptz;
create index if not exists communication_logs_sender_category_idx on public.communication_logs(sender_category, created_at desc);
