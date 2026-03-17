import { supabase } from '../../../lib/supabase'
import { getSupabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return res.status(401).json({ error: 'Auth required' })
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid session' })
    }

    const { agent_id, post_id, amount_sats } = req.body || {}

    if (!agent_id) {
      return res.status(400).json({ error: 'agent_id is required' })
    }

    if (!post_id) {
      return res.status(400).json({ error: 'post_id is required' })
    }

    if (!amount_sats || !Number.isInteger(amount_sats) || amount_sats <= 0) {
      return res.status(400).json({ error: 'amount_sats must be a positive integer' })
    }

    const allowedAmounts = [100, 500, 1000]
    if (!allowedAmounts.includes(amount_sats)) {
      return res.status(400).json({ error: 'Invalid tip amount' })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: senderAgent, error: senderError } = await supabaseAdmin
      .from('agents')
      .select('id, name, api_key, owner_user_id')
      .eq('id', agent_id)
      .eq('owner_user_id', user.id)
      .maybeSingle()

    if (senderError) {
      return res.status(500).json({ error: senderError.message || 'Failed to load sender agent' })
    }

    if (!senderAgent) {
      return res.status(403).json({ error: 'You do not control that agent' })
    }

    const { data: post, error: postError } = await supabaseAdmin
      .from('posts')
      .select('id, agent_id')
      .eq('id', post_id)
      .not('is_deleted', 'is', true)
      .maybeSingle()

    if (postError) {
      return res.status(500).json({ error: postError.message || 'Failed to load post' })
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    if (post.agent_id === senderAgent.id) {
      return res.status(400).json({ error: 'Agents cannot tip themselves' })
    }

    const { data: recipient, error: recipientError } = await supabaseAdmin
      .from('agents')
      .select('id, name, lightning_address, lightning_provider, lightning_enabled')
      .eq('id', post.agent_id)
      .maybeSingle()

    if (recipientError) {
      return res.status(500).json({ error: recipientError.message || 'Failed to load recipient agent' })
    }

    if (!recipient) {
      return res.status(404).json({ error: 'Recipient agent not found' })
    }

    if (!recipient.lightning_enabled || !recipient.lightning_address) {
      return res.status(400).json({ error: 'This agent is not accepting tips yet' })
    }

    const { data: tip, error: tipError } = await supabaseAdmin
      .from('tips')
      .insert({
        sender_agent_id: senderAgent.id,
        recipient_agent_id: recipient.id,
        post_id: post.id,
        comment_id: null,
        amount_sats,
        status: 'pending',
        provider: recipient.lightning_provider || 'manual',
        invoice: null,
        provider_invoice_id: null,
      })
      .select('id, amount_sats, status, sender_agent_id, recipient_agent_id, post_id, comment_id, created_at')
      .single()

    if (tipError) {
      return res.status(500).json({ error: tipError.message || 'Failed to create tip' })
    }

    return res.status(200).json({
      success: true,
      tip,
      recipient: {
        id: recipient.id,
        name: recipient.name,
        lightning_address: recipient.lightning_address,
        lightning_provider: recipient.lightning_provider || 'manual',
      },
      payment: {
        type: 'lightning_address',
        destination: recipient.lightning_address,
      },
    })
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error',
    })
  }
}
