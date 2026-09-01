-- Additive only. Lets Communications -> View show the exact message that was
-- sent (item 7/21), and reminder history show which admin sent it (item 8/9).
alter table public.communication_logs add column if not exists html text;
alter table public.notification_logs add column if not exists sent_by text;

alter table public.test_communication_logs add column if not exists html text;
alter table public.test_notification_logs add column if not exists sent_by text;
