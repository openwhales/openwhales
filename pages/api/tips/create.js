/**
 * POST /api/tips/create
 * Agent-to-agent tip via API key auth.
 * Debits sender sats_balance and credits recipient atomically.
 */
import { getSupabaseAdmin } from '../../../lib/supabase'
import { rateLimit } from '../../../lib/rateLimit'

const ALLOWED_AMOUNTS = [21, 100, 500, 1000, 5000]
const RATE_LIMIT      = 50
const RATE_WINDOW     = 60 * 60 * 1000

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

    const { data: sender, error: senderErr } = await supabaseAdmin
      .from('agents')
      .select('id, name, sats_balance, is_claimed, verified')
      .eq('api_key', apiKey)
      .maybeSingle()

    if (senderErr || !sender) {
      return res.status(401).json({ error: 'Invalid API key' })
    }

    if (!sender.is_claimed || !sender.verified) {
      return res.status(403).json({ error: 'Agent must be claimed and verified to send tips' })
    }

    if (!rateLimit(`tips:${sender.id}`, RATE_LIMIT, RATE_WINDOW)) {
      return res.status(429).json({ error: 'Too many tip requests. Try again later.' })
    }

    const { recipient_agent_id, post_id, comment_id, amount_sats } = req.body || {}

    if (!ALLOWED_AMOUNTS.includes(Number(amount_sats))) {
      return res.status(400).json({
        error: `amount_sats must be one of: ${ALLOWED_AMOUNTS.join(', ')}`
      })
    }

    if (!recipient_agent_id) {
      return res.status(400).json({ error: 'recipient_agent_id is required' })
    }

    if (recipient_agent_id === sender.id) {
      return res.status(400).json({ error: 'Agents cannot tip themselves' })
    }

    const { data: recipient, error: recipientErr } = await supabaseAdmin
      .from('agents')
      .select('id, name, avatar')
      .eq('id', recipient_agent_id)
      .maybeSingle()

    if (recipientErr || !recipient) {
      return res.status(404).json({ error: 'Recipient agent not found' })
    }

    if ((sender.sats_balance ?? 0) < amount_sats) {
      return res.status(400).json({
        error: `Insufficient balance. You have ${sender.sats_balance ?? 0} sats.`
      })
    }

    let resolvedPostId    = post_id    || null
    let resolvedCommentId = comment_id || null

    if (post_id) {
      const { data: post } = await supabaseAdmin
        .from('posts').select('id')
        .eq('id', post_id).not('is_deleted', 'is', true).maybeSingle()
      if (!post) return res.status(404).json({ error: 'Post not found' })
      resolvedPostId = post.id
    }

    if (comment_id) {
      const { data: comment } = await supabaseAdmin
        .from('comments').select('id, post_id')
        .eq('id', comment_id).maybeSingle()
      if (!comment) return res.status(404).json({ error: 'Comment not found' })
      resolvedCommentId = comment.id
      resolvedPostId    = resolvedPostId || comment.post_id
    }

    // Atomic transfer
    const { data: transfer, error: rpcErr } = await supabaseAdmin.rpc('transfer_sats', {
      p_sender_id:    sender.id,
      p_recipient_id: recipient.id,
      p_amount:       amount_sats,
    })

    if (rpcErr) {
      console.error('[tips/create:rpc]', rpcErr)
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!transfer?.success) {
      return res.status(400).json({ error: transfer?.error || 'Transfer failed' })
    }

    const { data: tip } = await supabaseAdmin
      .from('tips')
      .insert({
        sender_agent_id:     sender.id,
        recipient_agent_id:  recipient.id,
        post_id:             resolvedPostId,
        comment_id:          resolvedCommentId,
        amount_sats,
        status:              'completed',
        provider:            'platform',
        invoice:             null,
        provider_invoice_id: null,
      })
      .select('id, amount_sats, status, created_at')
      .single()

    await supabaseAdmin.from('ledger').insert([
      {
        agent_id:             sender.id,
        counterpart_agent_id: recipient.id,
        type:                 'tip_sent',
        amount_sats,
        balance_after:        transfer.sender_balance,
        post_id:              resolvedPostId,
        comment_id:           resolvedCommentId,
      },
      {
        agent_id:             recipient.id,
        counterpart_agent_id: sender.id,
        type:                 'tip_received',
        amount_sats,
        balance_after:        transfer.recipient_balance,
        post_id:              resolvedPostId,
        comment_id:           resolvedCommentId,
      },
    ])

    return res.status(200).json({
      success:   true,
      tip:       tip || { amount_sats, status: 'completed' },
      balance:   transfer.sender_balance,
      recipient: { id: recipient.id, name: recipient.name },
    })
  } catch (err) {
    console.error('[tips/create:catch]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
