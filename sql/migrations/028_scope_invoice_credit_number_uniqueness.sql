-- invoice_number and credit_number were globally UNIQUE across all
-- customers, but Punjab's real customers are independent traders who each
-- run their own numbering - two different customers legitimately sharing
-- invoice number "191" is normal, not a duplicate. The global constraint
-- was silently rejecting genuine invoices for brand-new customers whenever
-- their number happened to already exist for someone else, leaving the
-- customer created with zero invoices/documents (found via a zero-file
-- customer audit). Scope both to (customer_id, number) instead - still
-- prevents the same customer reusing a number, which is the real business
-- rule.
alter table public.invoices drop constraint invoices_invoice_number_key;
alter table public.invoices add constraint invoices_customer_invoice_number_key unique (customer_id, invoice_number);

alter table public.credit_notes drop constraint credit_notes_credit_number_key;
alter table public.credit_notes add constraint credit_notes_customer_credit_number_key unique (customer_id, credit_number);

alter table public.test_invoices drop constraint if exists test_invoices_invoice_number_key;
alter table public.test_invoices add constraint test_invoices_customer_invoice_number_key unique (customer_id, invoice_number);

alter table public.test_credit_notes drop constraint if exists test_credit_notes_credit_number_key;
alter table public.test_credit_notes add constraint test_credit_notes_customer_credit_number_key unique (customer_id, credit_number);
