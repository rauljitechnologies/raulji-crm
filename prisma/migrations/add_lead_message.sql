-- Migration: Add message field to leads table
-- Run: psql $DATABASE_URL -f prisma/migrations/add_lead_message.sql

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "message" TEXT;
