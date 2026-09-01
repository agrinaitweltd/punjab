-- Tracks which renderer actually produced an invoice's generated PDF
-- (item 10: "prevent this happening silently again"). Root cause of the
-- 2026-08-27 to 09-01 outage: when the Word-to-PDF converter (ConvertAPI)
-- fails, convertDocxToPdf() has always fallen back to a bare-bones pdf-lib
-- render so the invoice import never blocks - but nothing recorded THAT it
-- fell back, so 177 invoices silently got the crude fallback PDF instead of
-- the official template with no visible error anywhere. This column plus
-- the imported_metadata.pdfGenerationPending flag (already existed for hard
-- failures) now cover the fallback case too, so it surfaces in Files, the
-- invoice page, notifications and the nightly health check instead of
-- looking like a normal success.
alter table public.invoices add column if not exists canonical_pdf_provider text;
alter table public.test_invoices add column if not exists canonical_pdf_provider text;
