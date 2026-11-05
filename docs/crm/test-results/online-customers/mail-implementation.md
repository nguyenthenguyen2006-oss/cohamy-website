# New online-order notification

The `website.order.received` event uses the existing durable document-mail outbox and worker. Migration 057 seeds one enabled global rule with TO `kangminamhd@gmail.com` and `nguyenptkthd@gmail.com`, and empty CC/BCC. It does not enqueue historical orders or overwrite an existing Admin rule. The normal Admin mail settings and MCP rule operations remain effective.

`enqueueWebsiteOrderReceived(sql, {id, code, createdAt?})` must be called only for a successful new order insert, inside the intake transaction. The existing public receipt replay paths must not call it. Its stable event key is `website.order.received:<order UUID>:1`; the seeded non-null rule ID preserves the existing event/rule uniqueness protection. Concurrent or repeated helper calls retain the original job and body.

The event is registered as `notificationOnly`, so the standard worker and settings UI support a message without a PDF. The body contains the order code, receipt time explicitly formatted in `Asia/Ho_Chi_Minh`, and `/crm/online-customers/<order UUID>`. Customer contact and delivery details remain behind the authenticated Admin page. There is no recipient fallback and no customer email copy.

The existing worker retains its outcomes: `PENDING`, `DEFERRED`, `RETRY`, `UNKNOWN`, provider `ACCEPTED`, and webhook-confirmed `DELIVERED`. In particular an ambiguous provider outcome stays `UNKNOWN` and is not automatically resent. Two-recipient delivery is not marked delivered until both recipients have delivery webhook evidence.

## Evidence

`mail-services-local.json` records seven passing groups against an independent PGlite fixture: seed preservation (including the QA instrumentation conflict), transaction rollback, exact recipients/time/link/no-PDF snapshot, duplicate/concurrent helper calls, Admin-choice preservation and no backfill, actual worker acceptance plus two synthetic delivery webhooks, and the unknown-result resend fence. Provider calls were injected fakes with no network use. TypeScript runtime execution, changed-source ESLint and whitespace checks passed. Public checkout integration and restricted PostgreSQL proof belong to the parent feature suite.

A read-only production MCP check before implementation found Brevo enabled/configured with encrypted database settings and no website event/rule. The sender was `nguyenthenguyen15hp@gmail.com`; webhook configuration was absent. That is configuration evidence, not proof of sending this new event to either requested recipient. This work sent no production email and made no production mutation.

The new order detail can read existing outbox columns `id`, `event`, `entity_id`, `status`, `attempts`, `recipients`, `last_error`, `created_at`, `updated_at`, filtered by `event='website.order.received'` and its order UUID. Avoid describing `ACCEPTED` as inbox delivery.

MCP có dùng được không? The existing document-mail settings/read/rule operations are reused; the parent regenerates the catalog and verifies the new feature in the deployed runtime.

MCP có đọc được dữ liệu này không? Existing Admin mail settings expose event/rule and job delivery state. New event/runtime proof is pending the parent release, and the local fake-provider result is not a real-delivery claim.
