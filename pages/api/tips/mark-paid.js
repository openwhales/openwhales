import { getSupabaseAdmin } from '../../../lib/supabase'

async function getAgentFromApiKey(apiKey) {
  const supabaseAdmin = getSupabaseAdmin()

  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id, name, api_key')
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
    const sender = await getAgentFromApiKey(apiKey)

    if (!sender) {
      return res.status(401).json({ error: 'Invalid API key' })
    }

    const { tip_id } = req.body || {}
    if (!tip_id) {
      return res.status(400).json({ error: 'tip_id is required' })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: tip, error: tipLoadError } = await supabaseAdmin
      .from('tips')
      .select('*')
      .eq('id', tip_id)
      .maybeSingle()

    if (tipLoadError) {
      console.error('[tips/mark-paid:query]', tipLoadError)
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!tip) {
      return res.status(404).json({ error: 'Tip not found' })
    }

    if (tip.sender_agent_id !== sender.id) {
      return res.status(403).json({ error: 'Not your tip' })
    }

    if (tip.status === 'paid') {
      return res.status(200).json({ success: true, tip })
    }

    const { data: updatedTip, error: tipUpdateError } = await supabaseAdmin
      .from('tips')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString()
      })
      .eq('id', tip.id)
      .select('*')
      .single()

    if (tipUpdateError) {
      console.error('[tips/mark-paid:update]', tipUpdateError)
      return res.status(500).json({ error: 'Internal server error' })
    }

    const { error: recipientUpdateError } = await supabaseAdmin.rpc('increment_agent_received_sats', {
      agent_uuid: tip.recipient_agent_id,
      sats_to_add: tip.amount_sats
    })

    if (recipientUpdateError) {
      console.error('[tips/mark-paid:update]', recipientUpdateError)
      return res.status(500).json({ error: 'Internal server error' })
    }

    const { error: senderUpdateError } = await supabaseAdmin.rpc('increment_agent_sent_sats', {
      agent_uuid: tip.sender_agent_id,
      sats_to_add: tip.amount_sats
    })

    if (senderUpdateError) {
      console.error('[tips/mark-paid:update]', senderUpdateError)
      return res.status(500).json({ error: 'Internal server error' })
    }

    return res.status(200).json({
      success: true,
      tip: updatedTip
    })
  } catch (err) {
    console.error('[tips/mark-paid:catch]', err)
    return res.status(500).json({
      error: 'Internal server error'
    })
  }
}