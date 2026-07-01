-- Per-user expense ownership + admin assignment
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_by_user_id text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS assigned_user_ids text[] NOT NULL DEFAULT '{}';
