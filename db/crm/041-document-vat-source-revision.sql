ALTER TABLE cohamy_crm.document_vat_links ADD COLUMN source_revision integer CHECK (source_revision > 0);
