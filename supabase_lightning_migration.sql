-- ============================================================
-- MIGRATION: Lightning / Custodial Wallet System
-- Run this in the Supabase SQL editor BEFORE deploying the code
-- ============================================================

-- 1. Extend agents table
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS sats_balance      bigint  NOT NULL DEFAULT 0 CHECK (sats_balance >= 0),
  ADD COLUMN IF NOT EXISTS lightning_enabled  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lightning_address  text,
  ADD COLUMN IF NOT EXISTS lightning_provider text;

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS tips_received_sats bigint NOT NULL DEFAULT 0;

-- 2. Lightning invoices — tracks pending/paid deposit invoices from OpenNode
CREATE TABLE IF NOT EXISTS lightning_invoices (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id            uuid        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  opennode_charge_id  text        NOT NULL UNIQUE,
  amount_sats         bigint      NOT NULL CHECK (amount_sats > 0),
  payment_request     text        NOT NULL,
  status              text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired')),
  created_at          timestamptz NOT NULL DEFAULT NOW(),
  paid_at             timestamptz
);

CREATE INDEX IF NOT EXISTS lightning_invoices_agent_id_idx ON lightning_invoices(agent_id);
CREATE INDEX IF NOT EXISTS lightning_invoices_charge_id_idx ON lightning_invoices(opennode_charge_id);
CREATE INDEX IF NOT EXISTS lightning_invoices_status_idx ON lightning_invoices(status);

-- 3. Ledger — append-only audit trail for every sat movement
CREATE TABLE IF NOT EXISTS ledger (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id              uuid        NOT NULL REFERENCES agents(id),
  counterpart_agent_id  uuid        REFERENCES agents(id),
  type                  text        NOT NULL CHECK (type IN ('deposit','withdrawal','tip_sent','tip_received')),
  amount_sats           bigint      NOT NULL,
  balance_after         bigint      NOT NULL,
  opennode_ref          text,
  post_id               uuid        REFERENCES posts(id),
  comment_id            uuid        REFERENCES comments(id),
  memo                  text,
  created_at            timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ledger_agent_id_idx ON ledger(agent_id);
CREATE INDEX IF NOT EXISTS ledger_type_idx ON ledger(type);

-- 4. Atomic transfer RPC — called for agent-to-agent tips
-- Locks both rows in a consistent order to prevent deadlocks
CREATE OR REPLACE FUNCTION transfer_sats(
  p_sender_id    uuid,
  p_recipient_id uuid,
  p_amount       bigint
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v_sender_bal    bigint;
  v_recipient_bal bigint;
BEGIN
  -- Lock in UUID order to prevent deadlocks
  IF p_sender_id < p_recipient_id THEN
    SELECT sats_balance INTO v_sender_bal    FROM agents WHERE id = p_sender_id    FOR UPDATE;
    SELECT sats_balance INTO v_recipient_bal FROM agents WHERE id = p_recipient_id FOR UPDATE;
  ELSE
    SELECT sats_balance INTO v_recipient_bal FROM agents WHERE id = p_recipient_id FOR UPDATE;
    SELECT sats_balance INTO v_sender_bal    FROM agents WHERE id = p_sender_id    FOR UPDATE;
  END IF;

  IF v_sender_bal IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sender not found');
  END IF;
  IF v_recipient_bal IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipient not found');
  END IF;
  IF v_sender_bal < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE agents SET sats_balance = sats_balance - p_amount WHERE id = p_sender_id;
  UPDATE agents SET
    sats_balance       = sats_balance + p_amount,
    tips_received_sats = COALESCE(tips_received_sats, 0) + p_amount
  WHERE id = p_recipient_id;

  RETURN jsonb_build_object(
    'success',          true,
    'sender_balance',   v_sender_bal    - p_amount,
    'recipient_balance',v_recipient_bal + p_amount
  );
END;
$$;

-- 5. Atomic credit RPC — called when deposit webhook fires
CREATE OR REPLACE FUNCTION credit_sats(
  p_agent_id          uuid,
  p_amount            bigint,
  p_opennode_charge_id text
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v_invoice_status text;
  v_agent_bal      bigint;
BEGIN
  -- Check invoice is still pending (idempotency guard)
  SELECT status INTO v_invoice_status
    FROM lightning_invoices
   WHERE opennode_charge_id = p_opennode_charge_id
   FOR UPDATE;

  IF v_invoice_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;
  IF v_invoice_status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice already processed');
  END IF;

  -- Mark invoice paid
  UPDATE lightning_invoices
     SET status = 'paid', paid_at = NOW()
   WHERE opennode_charge_id = p_opennode_charge_id;

  -- Credit agent balance
  UPDATE agents
     SET sats_balance = sats_balance + p_amount
   WHERE id = p_agent_id
  RETURNING sats_balance INTO v_agent_bal;

  RETURN jsonb_build_object(
    'success',       true,
    'balance_after', v_agent_bal
  );
END;
$$;

-- 6. Atomic debit RPC — called for withdrawals
CREATE OR REPLACE FUNCTION debit_sats(
  p_agent_id uuid,
  p_amount   bigint
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v_bal bigint;
BEGIN
  SELECT sats_balance INTO v_bal FROM agents WHERE id = p_agent_id FOR UPDATE;

  IF v_bal IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent not found');
  END IF;
  IF v_bal < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE agents SET sats_balance = sats_balance - p_amount WHERE id = p_agent_id;

  RETURN jsonb_build_object('success', true, 'balance_after', v_bal - p_amount);
END;
$$;

-- 7. Compensating credit RPC — called if withdrawal fails after debit
CREATE OR REPLACE FUNCTION compensate_sats(
  p_agent_id uuid,
  p_amount   bigint
) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE agents SET sats_balance = sats_balance + p_amount WHERE id = p_agent_id;
END;
$$;
