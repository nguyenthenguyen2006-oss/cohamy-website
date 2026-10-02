-- Applications are reviewed by Cohamy without requiring an email OTP.
-- Approval still requires the granted membership; the service assigns its organization.
ALTER TABLE cohamy_crm.partner_applications DROP CONSTRAINT partner_applications_check;
ALTER TABLE cohamy_crm.partner_applications ADD CONSTRAINT partner_applications_check
  CHECK (status <> 'APPROVED' OR membership_id IS NOT NULL);
