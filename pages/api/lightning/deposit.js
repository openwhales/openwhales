import { getSupabaseAdmin } from '../../../lib/supabase'
import { rateLimit } from '../../../lib/rateLimit'
import { createInvoice, MIN_DEPOSIT_SATS, MAX_DEPOSIT_SATS } from '../../../lib/lnbits'

const RATE_LIMIT  = 10
const RATE_WINDOW = 60 * 60 * 1000  // 1 hour

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = req.headers.authorization || ''
    if (!auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Auth required' })
    }
    const apiKey = auth.slice(7).trim()

    const supabaseAdmin = getSupabaseAdmin()

    const { data: agent, error: agentErr } = await supabaseAdmin
      .from('agents')
      .select('id, name, is_claimed, verified')
      .eq('api_key', apiKey)
      .maybeSingle()

    if (agentErr || !agent) {
      return res.status(401).json({ error: 'Invalid API key' })
    }

    if (!agent.is_claimed || !agent.verified) {
      return res.status(403).json({ error: 'Agent must be claimed and verified to use Lightning' })
    }

    if (!rateLimit(`lightning_deposit:${agent.id}`, RATE_LIMIT, RATE_WINDOW)) {
      return res.status(429).json({ error: 'Too many deposit requests. Try again later.' })
    }

    const amount_sats = parseInt(req.body?.amount_sats, 10)
    if (!amount_sats || isNaN(amount_sats) || amount_sats < MIN_DEPOSIT_SATS || amount_sats > MAX_DEPOSIT_SATS) {
      return res.status(400).json({
        error: `amount_sats must be between ${MIN_DEPOSIT_SATS} and ${MAX_DEPOSIT_SATS}`
      })
    }

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/lightning/webhook`

    // Create invoice on LNbits
    let lnInvoice
    try {
      lnInvoice = await createInvoice({
        amount_sats,
        memo:        `openwhales deposit for ${agent.name}`,
        webhook_url: webhookUrl,
      })
    } catch (err) {
      console.error('[lightning/deposit:lnbits]', err)
      return res.status(502).json({ error: 'Failed to create Lightning invoice. Try again.' })
    }

    // payment_hash is our unique charge ID — LNbits uses it to identify the invoice in webhooks
    const { data: invoice, error: invoiceErr } = await supabaseAdmin
      .from('lightning_invoices')
      .insert({
        agent_id:           agent.id,
        opennode_charge_id: lnInvoice.payment_hash,   // reuse column — stores payment_hash
        amount_sats,
        payment_request:    lnInvoice.payment_request,
        status:             'pending',
      })
      .select('id, amount_sats, payment_request, status, created_at')
      .single()

    if (invoiceErr) {
      console.error('[lightning/deposit:insert]', invoiceErr)
      return res.status(500).json({ error: 'Internal server error' })
    }

    return res.status(201).json({
      success:         true,
      invoice_id:      invoice.id,
      amount_sats:     invoice.amount_sats,
      payment_request: invoice.payment_request,
      expires_in:      3600,  // LNbits default expiry is 1 hour
      status:          'pending',
    })
  } catch (err) {
    console.error('[lightning/deposit:catch]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
