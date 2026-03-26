import { getSupabaseAdmin } from '../../../lib/supabase'
import { verifyWebhook } from '../../../lib/opennode'

// OpenNode sends raw body — disable Next.js body parsing so we get the raw payload
export const config = { api: { bodyParser: true } }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const payload = req.body || {}
    const { id: chargeId, status, hashed_order } = payload

    if (!chargeId || !hashed_order) {
      return res.status(400).json({ error: 'Invalid webhook payload' })
    }

    // Verify HMAC signature — reject anything that fails
    if (!verifyWebhook({ id: chargeId, hashed_order })) {
      console.error('[lightning/webhook] Invalid HMAC signature', { chargeId })
      return res.status(401).json({ error: 'Invalid signature' })
    }

    // Only credit on paid status
    if (status !== 'paid') {
      return res.status(200).json({ received: true, action: 'noop', status })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Look up the pending invoice
    const { data: invoice, error: invErr } = await supabaseAdmin
      .from('lightning_invoices')
      .select('id, agent_id, amount_sats, status')
      .eq('opennode_charge_id', chargeId)
      .maybeSingle()

    if (invErr) {
      console.error('[lightning/webhook:lookup]', invErr)
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!invoice) {
      // Unknown charge — might be from a different system; ignore gracefully
      console.warn('[lightning/webhook] Unknown charge ID', chargeId)
      return res.status(200).json({ received: true, action: 'unknown_charge' })
    }

    if (invoice.status !== 'pending') {
      // Already processed — idempotent response
      return res.status(200).json({ received: true, action: 'already_processed' })
    }

    // Atomic credit via RPC (marks invoice paid + credits balance in one transaction)
    const { data: result, error: rpcErr } = await supabaseAdmin.rpc('credit_sats', {
      p_agent_id:           invoice.agent_id,
      p_amount:             invoice.amount_sats,
      p_opennode_charge_id: chargeId,
    })

    if (rpcErr) {
      console.error('[lightning/webhook:rpc]', rpcErr)
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!result?.success) {
      // Could be a duplicate if two webhooks raced — safe to return 200
      console.warn('[lightning/webhook:rpc] credit_sats returned', result)
      return res.status(200).json({ received: true, action: 'rpc_noop', detail: result?.error })
    }

    // Write ledger entry
    await supabaseAdmin.from('ledger').insert({
      agent_id:     invoice.agent_id,
      type:         'deposit',
      amount_sats:  invoice.amount_sats,
      balance_after: result.balance_after,
      opennode_ref: chargeId,
    })

    console.log('[lightning/webhook] Credited', invoice.amount_sats, 'sats to agent', invoice.agent_id)

    return res.status(200).json({ received: true, action: 'credited', amount_sats: invoice.amount_sats })
  } catch (err) {
    console.error('[lightning/webhook:catch]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
