-- Migration: Sync leads table with current Prisma schema
-- Run: psql $DATABASE_URL -f prisma/migrations/add_lead_country_service.sql

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "country"           TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "service"           TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "ai_score"          INTEGER;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "ai_score_factors"  JSONB;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "deal_value"        DOUBLE PRECISION;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "currency"          TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "tags"              TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "notes"             TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "custom_fields"     JSONB;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "last_activity_at"  TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "next_follow_up_at" TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "source"            TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "status"            TEXT NOT NULL DEFAULT 'NEW';
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "priority"          TEXT NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "is_deleted"        BOOLEAN NOT NULL DEFAULT false;

-- Indexes
CREATE INDEX IF NOT EXISTS "leads_company_id_status_idx" ON "leads"("company_id", "status");
CREATE INDEX IF NOT EXISTS "leads_company_id_source_idx" ON "leads"("company_id", "source");
