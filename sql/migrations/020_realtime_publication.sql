-- Nothing was in the supabase_realtime publication at all (confirmed live:
-- `select * from pg_publication_tables where pubname='supabase_realtime'`
-- returned zero rows) - postgres_changes events cannot fire for any table
-- until it's added here, regardless of client-side subscription code.
--
-- Safe to add: every one of these tables already has RLS enabled with a
-- `SELECT` policy of `is_admin() OR <own row>` (verified live), so Realtime
-- - which honours the same RLS as a normal query - grants each admin
-- session exactly the same visibility it already has today. Nothing is
-- newly exposed.

alter publication supabase_realtime add table
  customers, invoices, invoice_items, payments, credit_notes, credit_note_allocations, activity_log,
  test_customers, test_invoices, test_invoice_items, test_payments, test_credit_notes, test_credit_note_allocations, test_activity_log;
