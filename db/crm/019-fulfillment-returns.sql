-- Fulfillment records are created only from confirmed orders and explicit reservations.
ALTER TABLE cohamy_crm.warehouse_locations ADD COLUMN kind text NOT NULL DEFAULT 'PICK'
 CHECK(kind IN('PICK','QUARANTINE','DAMAGED'));

CREATE TABLE cohamy_crm.delivery_backorders (
 id uuid PRIMARY KEY,order_id uuid NOT NULL REFERENCES cohamy_crm.sales_orders(id),product_id uuid NOT NULL REFERENCES cohamy_crm.products(id),
 quantity numeric(30,6) NOT NULL CHECK(quantity>0),expected_on date,owner_membership_id uuid REFERENCES cohamy_crm.memberships(id),
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','RESOLVED','CANCELLED')),reason text NOT NULL,version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(order_id,product_id,status)
);
CREATE TABLE cohamy_crm.deliveries (
 id uuid PRIMARY KEY,code text NOT NULL UNIQUE,order_id uuid NOT NULL REFERENCES cohamy_crm.sales_orders(id),
 status text NOT NULL DEFAULT 'PLANNED' CHECK(status IN('PLANNED','PICKING','PACKED','IN_TRANSIT','DELIVERED','FAILED','RETURNING','RETURNED','CANCELLED')),
 window_start timestamptz,window_end timestamptz,timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',requirements text NOT NULL DEFAULT '',
 next_attempt_at timestamptz,version integer NOT NULL DEFAULT 1,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(window_start IS NULL OR window_end IS NULL OR window_end>window_start)
);
CREATE TABLE cohamy_crm.delivery_lines (
 id uuid PRIMARY KEY,delivery_id uuid NOT NULL REFERENCES cohamy_crm.deliveries(id),reservation_id uuid NOT NULL REFERENCES cohamy_crm.inventory_reservations(id),
 planned numeric(30,6) NOT NULL CHECK(planned>0),picked numeric(30,6) NOT NULL DEFAULT 0,packed numeric(30,6) NOT NULL DEFAULT 0,
 dispatched numeric(30,6) NOT NULL DEFAULT 0,delivered numeric(30,6) NOT NULL DEFAULT 0,version integer NOT NULL DEFAULT 1,
 CHECK(picked>=0 AND packed>=0 AND dispatched>=0 AND delivered>=0),
 CHECK(picked<=planned AND packed<=picked AND dispatched<=packed AND delivered<=dispatched),UNIQUE(delivery_id,reservation_id)
);
CREATE TABLE cohamy_crm.delivery_events (
 id uuid PRIMARY KEY,delivery_id uuid NOT NULL REFERENCES cohamy_crm.deliveries(id),action text NOT NULL,
 payload jsonb NOT NULL,checksum text NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,
 idempotency_key uuid NOT NULL,request_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER delivery_events_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.delivery_events
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.pick_events (
 id uuid PRIMARY KEY,delivery_line_id uuid NOT NULL REFERENCES cohamy_crm.delivery_lines(id),quantity numeric(30,6) NOT NULL CHECK(quantity>0),
 scanner_code text NOT NULL,manual boolean NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,
 idempotency_key uuid NOT NULL,request_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER pick_events_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.pick_events
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();

CREATE TABLE cohamy_crm.delivery_parcels (
 id uuid PRIMARY KEY,delivery_id uuid NOT NULL REFERENCES cohamy_crm.deliveries(id),code text NOT NULL UNIQUE,label text NOT NULL,
 status text NOT NULL DEFAULT 'PACKED' CHECK(status IN('PACKED','IN_TRANSIT','DELIVERED','FAILED','RETURNING','RETURNED')),
 version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.delivery_parcel_lines (
 parcel_id uuid NOT NULL REFERENCES cohamy_crm.delivery_parcels(id),delivery_line_id uuid NOT NULL REFERENCES cohamy_crm.delivery_lines(id),
 quantity numeric(30,6) NOT NULL CHECK(quantity>0),PRIMARY KEY(parcel_id,delivery_line_id)
);
CREATE TABLE cohamy_crm.delivery_trips (
 id uuid PRIMARY KEY,code text NOT NULL UNIQUE,driver_name text NOT NULL,driver_phone text NOT NULL,route_note text NOT NULL,
 status text NOT NULL DEFAULT 'PLANNED' CHECK(status IN('PLANNED','IN_TRANSIT','COMPLETED','CANCELLED')),version integer NOT NULL DEFAULT 1,
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.delivery_trip_parcels (
 trip_id uuid NOT NULL REFERENCES cohamy_crm.delivery_trips(id),parcel_id uuid NOT NULL REFERENCES cohamy_crm.delivery_parcels(id),
 stop_number integer NOT NULL CHECK(stop_number>0),active boolean NOT NULL DEFAULT true,PRIMARY KEY(trip_id,parcel_id)
);
CREATE UNIQUE INDEX delivery_parcel_one_active_trip ON cohamy_crm.delivery_trip_parcels(parcel_id) WHERE active;

CREATE TABLE cohamy_crm.carrier_connections (
 id uuid PRIMARY KEY,code text NOT NULL UNIQUE,name text NOT NULL,enabled boolean NOT NULL DEFAULT false,
 webhook_secret_ciphertext text,version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.carrier_events (
 id uuid PRIMARY KEY,parcel_id uuid NOT NULL REFERENCES cohamy_crm.delivery_parcels(id),connection_id uuid REFERENCES cohamy_crm.carrier_connections(id),
 provider_event_id text,status text NOT NULL,tracking_code text,verified boolean NOT NULL,manual boolean NOT NULL,payload jsonb NOT NULL,
 actor_id uuid REFERENCES cohamy_crm.users(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX carrier_event_exact_once ON cohamy_crm.carrier_events(connection_id,provider_event_id) WHERE provider_event_id IS NOT NULL;
CREATE TRIGGER carrier_events_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.carrier_events
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.delivery_proofs (
 id uuid PRIMARY KEY,delivery_id uuid NOT NULL UNIQUE REFERENCES cohamy_crm.deliveries(id),recipient text NOT NULL,
 received_at timestamptz NOT NULL,photo_document_id uuid REFERENCES cohamy_crm.document_versions(id),signature_document_id uuid REFERENCES cohamy_crm.document_versions(id),
 confirmation text NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cohamy_crm.return_requests (
 id uuid PRIMARY KEY,code text NOT NULL UNIQUE,order_id uuid NOT NULL REFERENCES cohamy_crm.sales_orders(id),
 status text NOT NULL DEFAULT 'REQUESTED' CHECK(status IN('REQUESTED','APPROVED','REJECTED','RECEIVED','CLOSED')),
 requester_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cohamy_crm.return_request_lines (
 id uuid PRIMARY KEY,request_id uuid NOT NULL REFERENCES cohamy_crm.return_requests(id),delivery_line_id uuid NOT NULL REFERENCES cohamy_crm.delivery_lines(id),
 quantity numeric(30,6) NOT NULL CHECK(quantity>0),reason text NOT NULL,photo_document_id uuid REFERENCES cohamy_crm.document_versions(id),UNIQUE(request_id,delivery_line_id)
);
CREATE TABLE cohamy_crm.return_events (
 id uuid PRIMARY KEY,request_id uuid NOT NULL REFERENCES cohamy_crm.return_requests(id),action text NOT NULL,payload jsonb NOT NULL,checksum text NOT NULL,
 actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),reason text NOT NULL,idempotency_key uuid NOT NULL,request_hash text NOT NULL,
 result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER return_events_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.return_events
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE TABLE cohamy_crm.return_dispositions (
 id uuid PRIMARY KEY,request_line_id uuid NOT NULL REFERENCES cohamy_crm.return_request_lines(id),quantity numeric(30,6) NOT NULL CHECK(quantity>0),
 disposition text NOT NULL CHECK(disposition IN('RESALE','QUARANTINE','DAMAGED')),location_id uuid NOT NULL REFERENCES cohamy_crm.warehouse_locations(id),
 document_id uuid NOT NULL REFERENCES cohamy_crm.inventory_documents(id),actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cohamy_crm.fulfillment_actions (
 id uuid PRIMARY KEY,action text NOT NULL,resource_id text NOT NULL,actor_id uuid NOT NULL REFERENCES cohamy_crm.users(id),
 idempotency_key uuid NOT NULL,request_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER fulfillment_actions_immutable BEFORE UPDATE OR DELETE ON cohamy_crm.fulfillment_actions
 FOR EACH ROW EXECUTE FUNCTION cohamy_crm.deny_audit_mutation();
CREATE INDEX deliveries_order ON cohamy_crm.deliveries(order_id,status,created_at);
CREATE INDEX return_requests_order ON cohamy_crm.return_requests(order_id,status,created_at);

ALTER TABLE cohamy_crm.notifications DROP CONSTRAINT notifications_entity_type_check;
ALTER TABLE cohamy_crm.notifications ADD CONSTRAINT notifications_entity_type_check
 CHECK(entity_type IN('partner','order','product','account','ticket','commercial-request','sales-order','delivery','return-request'));
