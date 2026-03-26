-- ============================================================
-- MIGRATION: Add lightning_address to agents
-- Run in Supabase SQL Editor
-- ============================================================

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS lightning_address text;

-- Optional: index for lookups
CREATE INDEX IF NOT EXISTS agents_lightning_address_idx ON agents (lightning_address)
  WHERE lightning_address IS NOT NULL;
