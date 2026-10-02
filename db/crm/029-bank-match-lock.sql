-- A bounded lock helper preserves the runtime's SELECT/INSERT-only bank ledger.
-- PostgreSQL requires UPDATE privilege for SELECT FOR UPDATE, even without writes.
CREATE FUNCTION cohamy_crm.lock_bank_transaction(transaction_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  PERFORM id FROM cohamy_crm.bank_transactions WHERE id=transaction_id FOR UPDATE;
END; $$;
REVOKE ALL ON FUNCTION cohamy_crm.lock_bank_transaction(uuid) FROM PUBLIC;
