-- 033_contact_reference.sql
-- Support messages can carry an invoice hash or transaction id so a dispute
-- can be matched without asking the member for it twice.

alter table public.contact
  add column if not exists reference varchar(191);
