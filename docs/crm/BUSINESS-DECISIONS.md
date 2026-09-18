# Cohamy - business decisions

Updated 2026-09-18T19:19:43.460Z.

| Decision | State | Source and scope | Remaining input |
|---|---|---|---|
| D01 | CONFIRMED_PARTIAL | User in this task on 19/09/2026: Form mở, Cohamy xét duyệt. Runtime default OPEN, optional INVITE; ADMIN review under existing account permission. | Business-required fields / final reviewer team |
| D02 | CONFIRMED_PARTIAL | User: brevo. Email adapter uses Brevo transactional API. | CRM_BREVO_API_KEY, verified CRM_BREVO_SENDER_EMAIL, explicitly designated test recipient and real delivery verification; CRM_EMAIL_ENABLED remains false in example |
| D03 | EXISTING_MODEL | Inherit DEALER_OWNER/DEALER_STAFF and current Cohamy-only internal roles; invitation server bounds organization/role. | Branch model / approved scope details |
| D04 | OPEN | No real wholesale price, fee, tax, discount/minimum/bonus policy supplied. | Approved versioned commercial policy |
| D05 | OPEN | Website READY remains intake only, unpaid, no warehouse/receivable/revenue posting. | Approval/reservation/ownership/receivable/revenue events |
| D06 | OPEN | Catalog SKU/unit metadata is not real stock or conversion ledger. QA SKU/unit fixture only. | Base units, ratios, commercial SKUs, warehouses, lots, opening balances and costing |
| D07 | OPEN | No lot/quarantine/FEFO/inventory policy assumed. | Minimum remaining shelf life and exceptions |
| D08 | OPEN | Support/file tools do not dispatch shipments or refunds. | Carrier, fees, proof of receipt, return/refund policy |
| D09 | OPEN | No consignment ledger or settlement activated. | Ownership, sale reporting, share formula and period |
| D10 | OPEN | No debt/credit/real money created. | Limits, terms, deposits, allocation, overdue exceptions and closing |
| D11 | OPEN | No real procurement/AP posting. | Purchase approval, receipt/return, payable and cost policy |
| D12 | CONFIRMED_PARTIAL | In-app notifications first; task opt-out applies. Display time Asia/Ho_Chi_Minh; storage UTC. | Quiet hours / escalation / external recipients |
| D13 | OPEN | Private documents are stored transactionally in PostgreSQL bytea, with version/read history. | Approved policy documents, backup destination/retention, RPO/RTO, restore owner |

Brevo contract source: [official send transactional email API](https://developers.brevo.com/reference/send-transac-email). Provider acceptance is distinct from mailbox delivery. QA uses a guarded preload for .invalid recipients; it is not part of the production adapter.
