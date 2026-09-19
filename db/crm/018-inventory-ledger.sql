-- Inventory opens with zero balances. No production stock is inferred or backfilled.

CREATE TABLE cohamy_crm.warehouse_locations (
 id uuid PRIMARY KEY,warehouse_id uuid NOT NULL REFERENCES cohamy_crm.warehouses(id),
 code text NOT NULL,name text NOT NULL,active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(warehouse_id,code)
);
CREATE TABLE cohamy_crm.inventory_lots (
 id uuid PRIMARY KEY,product_id uuid NOT NULL REFERENCES cohamy_crm.products(id),code text NOT NULL,
 manufactured_on date,expires_on date,status text NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN('AVAILABLE','LOCKED','RECALLED','EXHAUSTED')),
 version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(manufactured_on IS NULL OR expires_on IS NULL OR expires_on>=manufactured_on),UNIQUE(product_id,code)
);
CREATE TABLE cohamy_crm.inventory_documents (
 id uuid PRIMARY KEY,code text NOT NULL UNIQUE,kind text NOT NULL CHECK(kind IN('RECEIPT','ISSUE','ADJUSTMENT','TRANSFER','COUNT','RETURN','REVERSAL')),
 status text NOT NULL DEFAULT 'POSTED' CHECK(status IN('POSTED','REVERSED')),
 organization_id uuid NOT NULL REFERENCES cohamy_crm.organizations(id),reference_type text NOT NULL,reference_id text NOT NULL,
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,idempotency_key uuid NOT NULL,request_hash text NOT NULL,
 reversal_document_id uuid REFERENCES cohamy_crm.inventory_documents(id),result jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(actor_id,idempotency_key),UNIQUE(reversal_document_id)
);
CREATE TABLE cohamy_crm.inventory_balances (
 warehouse_id uuid NOT NULL REFERENCES cohamy_crm.warehouses(id),location_id uuid NOT NULL REFERENCES cohamy_crm.warehouse_locations(id),
 product_id uuid NOT NULL REFERENCES cohamy_crm.products(id),lot_id uuid NOT NULL REFERENCES cohamy_crm.inventory_lots(id),
 on_hand numeric(30,6) NOT NULL DEFAULT 0,reserved numeric(30,6) NOT NULL DEFAULT 0,version integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(warehouse_id,location_id,product_id,lot_id),
 CHECK(on_hand>=0),CHECK(reserved>=0),CHECK(reserved<=on_hand)
);
CREATE TABLE cohamy_crm.inventory_movements (
 id uuid PRIMARY KEY,document_id uuid NOT NULL REFERENCES cohamy_crm.inventory_documents(id),
 warehouse_id uuid NOT NULL REFERENCES cohamy_crm.warehouses(id),location_id uuid NOT NULL REFERENCES cohamy_crm.warehouse_locations(id),
 product_id uuid NOT NULL REFERENCES cohamy_crm.products(id),lot_id uuid NOT NULL REFERENCES cohamy_crm.inventory_lots(id),
 quantity numeric(30,6) NOT NULL CHECK(quantity<>0),balance_after numeric(30,6) NOT NULL CHECK(balance_after>=0),
 unit_snapshot jsonb NOT NULL,source_order_id uuid REFERENCES cohamy_crm.sales_orders(id),
 reversal_of uuid REFERENCES cohamy_crm.inventory_movements(id),actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(reversal_of)
);
CREATE TRIGGER inventory_movements_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.inventory_movements
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();

CREATE TABLE cohamy_crm.inventory_reservations (
 id uuid PRIMARY KEY,order_id uuid NOT NULL REFERENCES cohamy_crm.sales_orders(id),order_version_id uuid NOT NULL REFERENCES cohamy_crm.sales_order_versions(id),
 warehouse_id uuid NOT NULL REFERENCES cohamy_crm.warehouses(id),location_id uuid NOT NULL REFERENCES cohamy_crm.warehouse_locations(id),
 product_id uuid NOT NULL REFERENCES cohamy_crm.products(id),lot_id uuid NOT NULL REFERENCES cohamy_crm.inventory_lots(id),
 quantity numeric(30,6) NOT NULL CHECK(quantity>0),consumed numeric(30,6) NOT NULL DEFAULT 0,released numeric(30,6) NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','PARTIAL','CONSUMED','RELEASED')),
 version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(consumed>=0 AND released>=0 AND consumed+released<=quantity)
);
CREATE INDEX inventory_reservations_order ON cohamy_crm.inventory_reservations(order_id,status);
CREATE TABLE cohamy_crm.inventory_reservation_events (
 id uuid PRIMARY KEY,reservation_id uuid NOT NULL REFERENCES cohamy_crm.inventory_reservations(id),action text NOT NULL CHECK(action IN('RESERVED','CONSUMED','RELEASED')),
 quantity numeric(30,6) NOT NULL CHECK(quantity>0),actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,
 idempotency_key uuid NOT NULL,request_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER inventory_reservation_events_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.inventory_reservation_events
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();

CREATE TABLE cohamy_crm.inventory_actions (
 id uuid PRIMARY KEY,action text NOT NULL,resource_id text NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 idempotency_key uuid NOT NULL,request_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER inventory_actions_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.inventory_actions
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();

CREATE TABLE cohamy_crm.inventory_transfers (
 id uuid PRIMARY KEY,code text NOT NULL UNIQUE,source_warehouse_id uuid NOT NULL REFERENCES cohamy_crm.warehouses(id),
 destination_warehouse_id uuid NOT NULL REFERENCES cohamy_crm.warehouses(id),status text NOT NULL CHECK(status IN('IN_TRANSIT','PARTIAL','RECEIVED','SHORT')),
 snapshot jsonb NOT NULL,checksum text NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,
 idempotency_key uuid NOT NULL,request_hash text NOT NULL,result jsonb NOT NULL,version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),CHECK(source_warehouse_id<>destination_warehouse_id),UNIQUE(actor_id,idempotency_key)
);
CREATE TABLE cohamy_crm.inventory_transfer_receipts (
 id uuid PRIMARY KEY,transfer_id uuid NOT NULL REFERENCES cohamy_crm.inventory_transfers(id),number integer NOT NULL,
 lines jsonb NOT NULL,checksum text NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,
 idempotency_key uuid NOT NULL,request_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(transfer_id,number),UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER inventory_transfer_receipts_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.inventory_transfer_receipts
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();

CREATE TABLE cohamy_crm.stock_counts (
 id uuid PRIMARY KEY,code text NOT NULL UNIQUE,warehouse_id uuid NOT NULL REFERENCES cohamy_crm.warehouses(id),
 status text NOT NULL CHECK(status IN('COUNTING','PREVIEW','POSTED','CANCELLED')),baseline_at timestamptz NOT NULL,
 snapshot jsonb NOT NULL,checksum text NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,
 version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.stock_count_events (
 id uuid PRIMARY KEY,count_id uuid NOT NULL REFERENCES cohamy_crm.stock_counts(id),action text NOT NULL CHECK(action IN('COUNTED','PREVIEWED','POSTED','CANCELLED')),
 snapshot jsonb NOT NULL,checksum text NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,
 idempotency_key uuid NOT NULL,request_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER stock_count_events_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.stock_count_events
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();

CREATE TABLE cohamy_crm.inventory_alert_rules (
 id uuid PRIMARY KEY,warehouse_id uuid NOT NULL REFERENCES cohamy_crm.warehouses(id),product_id uuid NOT NULL REFERENCES cohamy_crm.products(id),
 low_available numeric(30,6) NOT NULL DEFAULT 0,slow_days integer NOT NULL DEFAULT 0,near_expiry_days integer NOT NULL DEFAULT 0,
 active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(warehouse_id,product_id),
 CHECK(low_available>=0 AND slow_days>=0 AND near_expiry_days>=0)
);
CREATE TABLE cohamy_crm.lot_recalls (
 id uuid PRIMARY KEY,lot_id uuid NOT NULL REFERENCES cohamy_crm.inventory_lots(id),status text NOT NULL CHECK(status IN('OPEN','CLOSED')),
 reason text NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.lot_recall_events (
 id uuid PRIMARY KEY,recall_id uuid NOT NULL REFERENCES cohamy_crm.lot_recalls(id),action text NOT NULL CHECK(action IN('OPENED','PROGRESS','CLOSED')),
 note text NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),idempotency_key uuid NOT NULL,request_hash text NOT NULL,
 result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER lot_recall_events_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.lot_recall_events
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();

ALTER TABLE cohamy_crm.order_change_previews
 ADD COLUMN idempotency_key uuid,ADD COLUMN request_hash text,ADD COLUMN checksum text,ADD COLUMN confirmed_at timestamptz;
CREATE UNIQUE INDEX order_change_preview_idempotency ON cohamy_crm.order_change_previews(actor_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
ALTER TABLE cohamy_crm.sales_orders DROP CONSTRAINT sales_orders_status_check;
ALTER TABLE cohamy_crm.sales_orders ADD CONSTRAINT sales_orders_status_check
 CHECK(status IN('PENDING_APPROVAL','CONFIRMED','CANCEL_REQUESTED','REJECTED','CANCELLED'));

CREATE INDEX inventory_balances_product ON cohamy_crm.inventory_balances(product_id,warehouse_id);
CREATE INDEX inventory_movements_trace ON cohamy_crm.inventory_movements(product_id,lot_id,created_at);
CREATE INDEX inventory_lots_expiry ON cohamy_crm.inventory_lots(product_id,status,expires_on);
