-- Add multi-user assignment to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS assigned_user_ids text[] NOT NULL DEFAULT '{}';
