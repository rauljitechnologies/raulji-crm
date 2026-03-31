-- Migration: Add Domain-Based AI Search tables
-- Run: psql $DATABASE_URL -f prisma/migrations/add_domain_search.sql

CREATE TABLE IF NOT EXISTS "search_domains" (
  "domain_id"       TEXT        NOT NULL PRIMARY KEY,
  "domain"          TEXT        NOT NULL UNIQUE,
  "name"            TEXT        NOT NULL,
  "anthropic_key"   TEXT        NOT NULL,
  "system_prompt"   TEXT,
  "auto_reply"      BOOLEAN     NOT NULL DEFAULT false,
  "auto_reply_msg"  TEXT,
  "credit_balance"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "credit_per_query" DOUBLE PRECISION NOT NULL DEFAULT 2,
  "is_active"       BOOLEAN     NOT NULL DEFAULT true,
  "search_api_key"  TEXT        NOT NULL UNIQUE,
  "total_queries"   INTEGER     NOT NULL DEFAULT 0,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "search_credits" (
  "credit_id"   TEXT        NOT NULL PRIMARY KEY,
  "domain_id"   TEXT        NOT NULL,
  "type"        TEXT        NOT NULL,
  "amount"      DOUBLE PRECISION NOT NULL,
  "description" TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "search_credits_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "search_domains"("domain_id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "search_credits_domain_id_idx" ON "search_credits"("domain_id");

CREATE TABLE IF NOT EXISTS "search_logs" (
  "log_id"       TEXT        NOT NULL PRIMARY KEY,
  "domain_id"    TEXT        NOT NULL,
  "query"        TEXT        NOT NULL,
  "answer"       TEXT,
  "credit_used"  DOUBLE PRECISION NOT NULL,
  "tokens"       INTEGER,
  "success"      BOOLEAN     NOT NULL DEFAULT true,
  "error_msg"    TEXT,
  "ip"           TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "search_logs_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "search_domains"("domain_id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "search_logs_domain_id_idx" ON "search_logs"("domain_id");

-- Auto-update updated_at for search_domains
CREATE OR REPLACE FUNCTION update_search_domain_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS search_domains_updated_at ON "search_domains";
CREATE TRIGGER search_domains_updated_at
  BEFORE UPDATE ON "search_domains"
  FOR EACH ROW EXECUTE FUNCTION update_search_domain_updated_at();
