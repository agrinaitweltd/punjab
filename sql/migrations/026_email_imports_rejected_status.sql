-- Adds an explicit "rejected" status so the new Review Invoice workflow can
-- mark a document as reviewed-and-declined (kept for audit, no financial
-- record ever created from it) - distinct from "failed" (parsing/system
-- error) and "needs_review" (nobody has looked at it yet).
alter table public.email_imports drop constraint email_imports_status_check;
alter table public.email_imports add constraint email_imports_status_check
  check (status = any (array['processing','imported','needs_review','failed','duplicate','rejected']));

alter table public.test_email_imports drop constraint if exists test_email_imports_status_check;
alter table public.test_email_imports add constraint test_email_imports_status_check
  check (status = any (array['processing','imported','needs_review','failed','duplicate','rejected']));
