-- Intake only: no reservation, stock movement, title transfer or receivable.
CREATE TABLE cohamy_crm.website_orders (
  id uuid PRIMARY KEY, code text NOT NULL UNIQUE, idempotency_key uuid NOT NULL UNIQUE,
  request_hash text NOT NULL, locale text NOT NULL CHECK(locale IN ('vi','en','zh','ko','ja')),
  contact jsonb NOT NULL, lines jsonb NOT NULL, subtotal numeric(18,0) NOT NULL CHECK(subtotal>=0),
  payment_requested text NOT NULL CHECK(payment_requested IN ('cod','bank','momo')),
  status text NOT NULL DEFAULT 'PENDING_REVIEW' CHECK(status='PENDING_REVIEW'),
  shipping_quote_pending boolean NOT NULL DEFAULT true, paid boolean NOT NULL DEFAULT false CHECK(paid=false),
  created_at timestamptz NOT NULL DEFAULT now()
);
