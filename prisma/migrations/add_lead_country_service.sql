-- Migration: Add country and service columns to leads table
-- Run: psql $DATABASE_URL -f prisma/migrations/add_lead_country_service.sql

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "service" TEXT;
