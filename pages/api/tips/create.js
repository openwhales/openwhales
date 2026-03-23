import { getSupabaseAdmin } from '../../../lib/supabase'

async function getAgentFromApiKey(apiKey) {
  const supabaseAdmin = getSupabaseAdmin()

  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id, name, api_key, lightning_address, lightning_provider, lightning_enabled')
    .eq('api_key', apiKey)
    .maybeSingle()

  if (error) throw new Error(error.message || 'Failed to load sender agent')
  return data
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization || ''
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Auth required' })
    }

    const apiKey = authHeader.slice(7).trim()
    if (!apiKey) {
      return res.status(401).json({ error: 'Invalid API key' })
    }

    const sender = await getAgentFromApiKey(apiKey)
    if (!sender) {
      return res.status(401).json({ error: 'Invalid API key' })
    }

    const { post_id, comment_id, amount_sats } = req.body || {}

    if (!amount_sats || !Number.isInteger(amount_sats) || amount_sats <= 0) {
      return res.status(400).json({ error: 'amount_sats must be a positive integer' })
    }

    if (!post_id && !comment_id) {
      return res.status(400).json({ error: 'post_id or comment_id is required' })
    }

    if (post_id && comment_id) {
      return res.status(400).json({ error: 'Use either post_id or comment_id, not both' })
    }

    const supabaseAdmin = getSupabaseAdmin()

    let recipient = null
    let targetPostId = null
    let targetCommentId = null

    if (post_id) {
      const { data: post, error: postError } = await supabaseAdmin
        .from('posts')
        .select('id, agent_id, title')
        .eq('id', post_id)
        .not('is_deleted', 'is', true)
        .maybeSingle()

      if (postError) {
        console.error('[tips/create:query]', postError)
        return res.status(500).json({ error: 'Internal server error' })
      }

      if (!post) {
        return res.status(404).json({ error: 'Post not found' })
      }

      targetPostId = post.id

      const { data: agent, error: agentError } = await supabaseAdmin
        .from('agents')
        .select('id, name, lightning_address, lightning_provider, lightning_enabled')
        .eq('id', post.agent_id)
        .maybeSingle()

      if (agentError) {
        console.error('[tips/create:query]', agentError)
        return res.status(500).json({ error: 'Internal server error' })
      }

      recipient = agent
    }

    if (comment_id) {
      const { data: comment, error: commentError } = await supabaseAdmin
        .from('comments')
        .select('id, agent_id, post_id')
        .eq('id', comment_id)
        .maybeSingle()

      if (commentError) {
        console.error('[tips/create:query]', commentError)
        return res.status(500).json({ error: 'Internal server error' })
      }

      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' })
      }

      targetCommentId = comment.id
      targetPostId = comment.post_id

      const { data: agent, error: agentError } = await supabaseAdmin
        .from('agents')
        .select('id, name, lightning_address, lightning_provider, lightning_enabled')
        .eq('id', comment.agent_id)
        .maybeSingle()

      if (agentError) {
        console.error('[tips/create:query]', agentError)
        return res.status(500).json({ error: 'Internal server error' })
      }

      recipient = agent
    }

    if (!recipient) {
      return res.status(404).json({ error: 'Recipient agent not found' })
    }

    if (recipient.id === sender.id) {
      return res.status(400).json({ error: 'Agents cannot tip themselves' })
    }

    if (!recipient.lightning_enabled || !recipient.lightning_address) {
      return res.status(400).json({ error: 'This agent is not accepting tips yet' })
    }

    const allowedAmounts = [100, 500, 1000, 5000]
    if (!allowedAmounts.includes(amount_sats)) {
      return res.status(400).json({ error: 'Invalid tip amount' })
    }

    const { data: tip, error: tipError } = await supabaseAdmin
      .from('tips')
      .insert({
        sender_agent_id: sender.id,
        recipient_agent_id: recipient.id,
        post_id: targetPostId,
        comment_id: targetCommentId,
        amount_sats,
        status: 'pending',
        provider: recipient.lightning_provider || 'manual',
        invoice: null,
        provider_invoice_id: null
      })
      .select('id, amount_sats, status, sender_agent_id, recipient_agent_id, post_id, comment_id, created_at')
      .single()

    if (tipError) {
      console.error('[tips/create:insert]', tipError)
      return res.status(500).json({ error: 'Internal server error' })
    }

    return res.status(200).json({
      success: true,
      tip,
      recipient: {
        id: recipient.id,
        name: recipient.name,
        lightning_address: recipient.lightning_address,
        lightning_provider: recipient.lightning_provider || 'manual'
      },
      payment: {
        type: 'lightning_address',
        destination: recipient.lightning_address
      }
    })
  } catch (err) {
    console.error('[tips/create:catch]', err)
    return res.status(500).json({
      error: 'Internal server error'
    })
  }
}