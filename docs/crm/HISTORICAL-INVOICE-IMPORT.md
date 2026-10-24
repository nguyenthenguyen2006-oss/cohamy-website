# Historical warehouse invoice archive

`/crm/historical-orders` stores invoices from before CRM operation, with original line items, invoice date, original VAT rounding, payment confirmation and unchanged source PNG bytes. It has no connection to live stock movements, reservations, receivables, payment receipts or current sales reports. Historical totals appear separately on this archive page. The supplied screenshot is retained as evidence, not represented as an original electronic-invoice XML file.

Admin, Manager and Accountant can read their organization's archive. HCM/HN warehouse roles see only the corresponding region. The generic warehouse role needs an explicit warehouse assignment. Sales, Factory and Portal roles cannot read this archive. A source-image URL enforces the same scope as metadata. Responses are private and uncached.

The importer is an operator CLI, not a public mutation API. Only a current Admin membership can import. A batch is atomic, requires a real warehouse in the Admin's organization, validates row/subtotal/payment arithmetic and PNG contents, and rejects conflicting invoice identities. The identity is seller tax ID + series + invoice number within the owning organization. Repeating an identical import returns the existing record. The database prevents rewriting or deleting the archived records.

Keep manifests, personal/business data, original screenshots and production import reports in a protected directory outside Git. The manifest contains `invoices`, each with `snapshot` (see `historicalInvoiceSchema`), `filename`, relative `sourceFile`, and optional expected `sourceSha256`. The current importer requires an explicitly confirmed, fully paid historical invoice. Do not infer payment dates or a specific cash/bank payment method from an invoice's generic payment-method label.

Use the verified runtime environment and a protected fresh backup with a successful restore before applying. First run:

```text
node --env-file=.env.production --require ./scripts/register-server-only.cjs --import tsx scripts/crm/import-historical-invoices.ts MANIFEST ADMIN_MEMBERSHIP_UUID WAREHOUSE_UUID PREVIEW_REPORT
```

Review the warehouse, each invoice and the source files, then pass that preview's checksum as the last argument to apply. A changed source or warehouse invalidates it. The CLI captures all existing business tables, except the append-only audit and archive tables, in one repeatable-read transaction. Any import-induced change to those existing tables aborts the import. Its receipt contains the unchanged table row counts and hashes. Retrying after an uncertain connection must start by inspecting the receipt and archive identities.

After applying, verify persisted snapshots/source hashes with `verify-historical-invoices-production.ts`, inspect the actual browser archive and source downloads, and take another backup/restore containing the imported files. That production verifier is intentionally bounded to the four-invoice HCM batch totaling VND 31,163,000; adapt it deliberately before using it for another batch. Never remove real imported records as test cleanup.

Local checks:

```text
node --require ./scripts/register-server-only.cjs --import tsx scripts/crm/verify-historical-invoices.ts
node scripts/crm/verify-historical-invoices-browser.mjs
```

These use synthetic data in isolated PGlite. They cover roles/regions, preview, duplicate/concurrent imports, whole-batch rollback, totals, source files, immutable rows and unchanged existing tables. They do not constitute production proof.
