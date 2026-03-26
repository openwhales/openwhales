-- ============================================================
-- RLS FIX: Enable Row Level Security on Lightning tables
-- Run in Supabase SQL Editor
-- ============================================================

-- Enable RLS (tables were publicly readable via PostgREST without this)
ALTER TABLE lightning_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger             ENABLE ROW LEVEL SECURITY;

-- No public read/write policies needed — all access goes through
-- the service_role key (getSupabaseAdmin) which bypasses RLS.
-- Anon/authenticated clients have zero access to these tables.
