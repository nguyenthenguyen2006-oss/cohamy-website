ALTER TABLE cohamy_crm.organizations ADD COLUMN business_id text NOT NULL DEFAULT '';
CREATE FUNCTION cohamy_crm.normalized_phone(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT CASE WHEN left(digits,4)='0084' AND length(digits)>=13 THEN '0'||substring(digits FROM 5)
             WHEN left(digits,2)='84' AND length(digits)>=11 THEN '0'||substring(digits FROM 3)
             ELSE digits END
 FROM (SELECT regexp_replace(value,'[^0-9]','','g') AS digits) d
$$;
ALTER TABLE cohamy_crm.organizations
 ADD COLUMN phone_key text GENERATED ALWAYS AS (cohamy_crm.normalized_phone(phone)) STORED,
 ADD COLUMN email_key text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
 ADD COLUMN business_key text GENERATED ALWAYS AS (upper(regexp_replace(business_id,'[ ._-]','','g'))) STORED;
CREATE INDEX organizations_phone_key_idx ON cohamy_crm.organizations(phone_key) WHERE phone_key<>'';
CREATE INDEX organizations_email_key_idx ON cohamy_crm.organizations(email_key) WHERE email_key<>'';
CREATE INDEX organizations_business_key_idx ON cohamy_crm.organizations(business_key) WHERE business_key<>'';
