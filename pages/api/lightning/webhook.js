import { getSupabaseAdmin } from '../../../lib/supabase'
import { getPayment } from '../../../lib/lnbits'

export const config = { api: { bodyParser: true } }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const payload = req.body || {}

    // LNbits webhook payload contains payment_hash (also as checking_id)
    const payment_hash = payload.payment_hash || payload.checking_id

    if (!payment_hash) {
      return res.status(400).json({ error: 'Invalid webhook payload — no payment_hash' })
    }

    // Verify with LNbits API — confirms this payment is actually paid
    // This prevents spoofed webhook calls since only we know valid payment hashes
    let payment
    try {
      payment = await getPayment(payment_hash)
    } catch (err) {
      console.error('[lightning/webhook:verify]', err)
      return res.status(502).json({ error: 'Could not verify payment with LNbits' })
    }

    if (!payment?.paid) {
      // Not paid yet — LNbits also fires webhooks on invoice creation in some configs
      return res.status(200).json({ received: true, action: 'noop', paid: false })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Look up the pending invoice by payment_hash (stored in opennode_charge_id column)
    const { data: invoice, error: invErr } = await supabaseAdmin
      .from('lightning_invoices')
      .select('id, agent_id, amount_sats, status')
      .eq('opennode_charge_id', payment_hash)
      .maybeSingle()

    if (invErr) {
      console.error('[lightning/webhook:lookup]', invErr)
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!invoice) {
      console.warn('[lightning/webhook] Unknown payment_hash', payment_hash)
      return res.status(200).json({ received: true, action: 'unknown_invoice' })
    }

    if (invoice.status !== 'pending') {
      // Already processed — idempotent
      return res.status(200).json({ received: true, action: 'already_processed' })
    }

    // Atomic credit — marks invoice paid + credits balance in one transaction
    const { data: result, error: rpcErr } = await supabaseAdmin.rpc('credit_sats', {
      p_agent_id:           invoice.agent_id,
      p_amount:             invoice.amount_sats,
      p_opennode_charge_id: payment_hash,
    })

    if (rpcErr) {
      console.error('[lightning/webhook:rpc]', rpcErr)
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!result?.success) {
      console.warn('[lightning/webhook:rpc] credit_sats returned', result)
      return res.status(200).json({ received: true, action: 'rpc_noop', detail: result?.error })
    }

    // Write ledger entry
    await supabaseAdmin.from('ledger').insert({
      agent_id:      invoice.agent_id,
      type:          'deposit',
      amount_sats:   invoice.amount_sats,
      balance_after: result.balance_after,
      opennode_ref:  payment_hash,
    })

    console.log('[lightning/webhook] Credited', invoice.amount_sats, 'sats to agent', invoice.agent_id)

    return res.status(200).json({ received: true, action: 'credited', amount_sats: invoice.amount_sats })
  } catch (err) {
    console.error('[lightning/webhook:catch]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
