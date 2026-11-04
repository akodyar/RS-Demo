-- HomeHub Phase 2: Canonical Chart of Accounts Initialization & Idempotent Upsert
-- Defines canonical accounts: 1010, 1200, 2010, 2100, 4000, 4010, 4011, 4012, 5000.
-- Account 4000 is classified as LIABILITY (clearing / allocation source, strictly excluded from Corporate P&L).
-- Accounts 4010, 4011, 4012 represent HomeHub Fee Revenues (Platform Fee, Rent Fee, Management Fee).
-- Account 2010 represents Owner Net Entitlement Payable.
-- Account 2100 represents Security Deposits Liability.

INSERT INTO "chart_of_accounts" ("id", "code", "name", "description", "account_type", "currency", "active", "system_account")
VALUES 
  ('coa_1010', '1010', 'Operating Cash', 'Operating bank and cash collection accounts', 'ASSET', 'IQD', true, true),
  ('coa_1200', '1200', 'Tenant Accounts Receivable', 'Outstanding rent receivables and tenant collection clearing', 'ASSET', 'IQD', true, true),
  ('coa_2000', '2000', 'Trade Accounts Payable', 'Outstanding vendor and contractor liabilities for operational expenses', 'LIABILITY', 'IQD', true, true),
  ('coa_2010', '2010', 'Owner Net Entitlement Payable', 'Net rental income collected and payable to property owners', 'LIABILITY', 'IQD', true, true),
  ('coa_2100', '2100', 'Security Deposits Liability', 'Custodial tenant security deposit funds held in escrow', 'LIABILITY', 'IQD', true, true),
  ('coa_4000', '4000', 'Gross Rent Clearing', 'Gross rent clearing and allocation source (non-corporate revenue transit account)', 'LIABILITY', 'IQD', true, true),
  ('coa_4010', '4010', 'Platform Fee Revenue', 'HomeHub platform technology service fee revenue', 'REVENUE', 'IQD', true, true),
  ('coa_4011', '4011', 'Rent Fee Revenue', 'HomeHub rent collection service fee revenue', 'REVENUE', 'IQD', true, true),
  ('coa_4012', '4012', 'Management Fee Revenue', 'HomeHub property management service fee revenue', 'REVENUE', 'IQD', true, true),
  ('coa_5000', '5000', 'Operating Expenses', 'Property and platform operational expenses', 'EXPENSE', 'IQD', true, true)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "account_type" = EXCLUDED."account_type",
  "currency" = EXCLUDED."currency",
  "active" = true,
  "system_account" = true,
  "updated_at" = now();
