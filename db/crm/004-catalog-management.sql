ALTER TABLE cohamy_crm.products
 ADD COLUMN stock_unit text NOT NULL DEFAULT '',
 ADD COLUMN units_per_case integer CHECK(units_per_case>0 AND units_per_case<=100000),
 ADD COLUMN active boolean NOT NULL DEFAULT true,
 ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE cohamy_crm.warehouses ADD COLUMN version integer NOT NULL DEFAULT 1;
