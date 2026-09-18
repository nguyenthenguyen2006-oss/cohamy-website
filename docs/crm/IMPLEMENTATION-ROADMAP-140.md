# Cohamy - implementation roadmap

P0: audited checkout and 140-ID matrix. Existing access/work features are partial baselines, not commercial ledgers.

Delivered source batches: P1 private workspace/docs/jobs plus P2 open registration/Brevo/review and P3 contacts/checklists/dependencies; independent portal carts/addresses/support added. Effort of remaining phases is substantial; no hard deadline inferred.

1. Complete P1 UI details: column ordering/width, filter edit/default, bulk preview, custom fields, MFA/recovery, session metadata, richer audit and real restart/restore.
2. Complete P2 acceptance: real authorized Brevo delivery, PostgreSQL competing reviews, applicant attachment requests, per-capability dealer permissions and first commercial request completion; duplicate preview, selected supplementation and staff locking/library are in source.
3. Continue P3: cross-source opportunity links and samples. Input duplicate/business-ID warnings and history-preserving merge are in source with actual Edge and DML-only PostgreSQL concurrency/rollback evidence. Recurrence/watchers/handoff/escalation/rules are deployed with PostgreSQL contention, actual worker recovery and Edge evidence.
4. P4: configure versioned D04/D05; implement pricing/quotes, portal preview/checkout and commercial orders with immutable price/address/policy snapshots and independent order/delivery/payment states.
5. P5: precise unit ratios, lot/owner ledger, reservations, transfer/count/quarantine and procurement. PostgreSQL multiconnection E06/E07/E08 gates mandatory.
6. P6: source-linked picking/packing/parcels/trips/delivery/returns. Carrier callbacks only after contract and credentials are ready.
7. P7: source-linked AR/AP, receipts/disbursements, deposits, allocation/reversal/bank suggestions/ageing. Confirm D05/D10/D11 first for true posting.
8. P8: agreement-versioned consignment sale/return/settlement with ownership and locked periods; D09 controls production activation.
9. P9: reports from verified ledgers, source drill-down, role dashboards and safe offline drafts.
10. P10: staging migration/backfill checks, independent PostgreSQL+file backup/restore, pilot, performance dataset/thresholds and release/rollback.

Each batch remains migration -> domain -> server scope/API -> usable UI -> behavioral test -> documentation. Missing policy does not prevent independent source development; no production posting uses invented assumptions.
