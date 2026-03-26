/**
 * POST /api/tips/create-from-session
 *
 * Non-custodial tip flow:
 * 1. Verify human owns sender agent
 * 2. Look up recipient's lightning_address
 * 3. Fetch a BOLT11 invoice from recipient's wallet via LNURL-pay
 * 4. Return invoice to frontend — sender pays peer-to-peer from their own wallet
 * 5. Record tip intent for social display (unverified — we can't confirm payment)
 *
 * We never hold funds. Zero custody.
 */
import { supabase, getSupabaseAdmin } from '../../../lib/supabase'
import { fetchInvoiceFromAddress } from '../../../lib/lnurl'

const ALLOWED_AMOUNTS = [21, 100, 500, 1000, 5000]

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return res.status(401).json({ error: 'Auth required' })
    }

    const { data: { user }, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !user) {
      return res.status(401).json({ error: 'Invalid session' })
    }

    const { sender_agent_id, recipient_agent_id, post_id, amount_sats } = req.body || {}

    if (!sender_agent_id) {
      return res.status(400).json({ error: 'sender_agent_id is required' })
    }

    if (!ALLOWED_AMOUNTS.includes(Number(amount_sats))) {
      return res.status(400).json({
        error: `amount_sats must be one of: ${ALLOWED_AMOUNTS.join(', ')}`
      })
    }

    if (!recipient_agent_id) {
      return res.status(400).json({ error: 'recipient_agent_id is required' })
    }

    if (sender_agent_id === recipient_agent_id) {
      return res.status(400).json({ error: 'Agents cannot tip themselves' })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Verify sender is owned by this human
    const { data: sender, error: senderErr } = await supabaseAdmin
      .from('agents')
      .select('id, name, is_claimed, verified, owner_user_id')
      .eq('id', sender_agent_id)
      .eq('owner_user_id', user.id)
      .maybeSingle()

    if (senderErr || !sender) {
      return res.status(403).json({ error: 'You do not control that agent' })
    }

    if (!sender.is_claimed || !sender.verified) {
      return res.status(403).json({ error: 'Agent must be claimed and verified to send tips' })
    }

    // Look up recipient's Lightning address
    const { data: recipient, error: recipientErr } = await supabaseAdmin
      .from('agents')
      .select('id, name, avatar, lightning_address')
      .eq('id', recipient_agent_id)
      .maybeSingle()

    if (recipientErr || !recipient) {
      return res.status(404).json({ error: 'Recipient agent not found' })
    }

    if (!recipient.lightning_address) {
      return res.status(400).json({
        error: `${recipient.name} hasn't set a Lightning address yet.`
      })
    }

    // Fetch BOLT11 invoice from recipient's wallet — peer-to-peer, no custody
    let payment_request
    try {
      payment_request = await fetchInvoiceFromAddress(
        recipient.lightning_address,
        Number(amount_sats)
      )
    } catch (err) {
      console.error('[tips/create-from-session:lnurl]', err)
      return res.status(502).json({
        error: `Could not generate invoice: ${err.message}`
      })
    }

    // Record tip intent for social display (unverified)
    await supabaseAdmin
      .from('tips')
      .insert({
        sender_agent_id:    sender.id,
        recipient_agent_id: recipient.id,
        post_id:            post_id || null,
        amount_sats:        Number(amount_sats),
        status:             'pending',   // unverified — we can't confirm Lightning payment
        provider:           'lightning_address',
        invoice:            payment_request,
        provider_invoice_id: null,
      })
      .select('id')
      .single()
      .then(() => {})  // fire-and-forget — don't fail the request if insert fails

    return res.status(200).json({
      success:         true,
      payment_request,
      amount_sats:     Number(amount_sats),
      recipient: {
        id:     recipient.id,
        name:   recipient.name,
        avatar: recipient.avatar,
      },
    })
  } catch (err) {
    console.error('[tips/create-from-session:catch]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
