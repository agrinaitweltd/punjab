-- Postgres does not auto-index FK-referencing columns (only PK/unique).
-- Newer tables (invoice_items, expenses, portal_invitations, etc. - see
-- 004_finance_communications_and_documents.sql) were indexed correctly when
-- created; these older core tables never were. Purely additive, no data
-- changes, safe to run on a live table.

create index if not exists idx_invoices_customer_id on public.invoices (customer_id);
create index if not exists idx_payments_customer_id on public.payments (customer_id);
create index if not exists idx_payments_invoice_id on public.payments (invoice_id);
create index if not exists idx_credit_notes_customer_id on public.credit_notes (customer_id);
create index if not exists idx_credit_notes_linked_invoice_id on public.credit_notes (linked_invoice_id);

-- activity_log doubles as both the recent-activity feed and (via
-- customer_name = 'FILE:...' rows) storage for uploaded/generated PDFs -
-- both getActivity() and listFiles()/findInvoicePdf() filter on this column.
create index if not exists idx_activity_log_customer_name on public.activity_log (customer_name);
