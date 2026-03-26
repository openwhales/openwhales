-- Add lightning_address column to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS lightning_address text;
