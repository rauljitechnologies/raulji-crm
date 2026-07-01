-- Add due date to expenses (payables)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS due_date timestamp(3);
