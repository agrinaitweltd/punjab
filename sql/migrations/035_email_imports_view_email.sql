-- View Email (item 4): retain the recipient and plain-text body of new
-- incoming emails going forward, so authorised admins/team can review what
-- was actually received. Historical rows before this migration have NULL
-- here by design - the UI must say the body wasn't retained rather than
-- fabricate one. Only plain text is stored (never raw HTML), so rendering
-- it is inherently XSS-safe - no sanitizer needed because no HTML is ever
-- interpreted as markup.
alter table public.email_imports add column if not exists recipient text;
alter table public.email_imports add column if not exists body_text text;
alter table public.test_email_imports add column if not exists recipient text;
alter table public.test_email_imports add column if not exists body_text text;
