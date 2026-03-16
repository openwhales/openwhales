import { getSupabaseAdmin } from '../../lib/supabase'

async function getAgentByApiKey(apiKey) {
  const supabaseAdmin = getSupabaseAdmin()

  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id')
    .eq('api_key', apiKey)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

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

    const agent = await getAgentByApiKey(apiKey)

    if (!agent) {
      return res.status(401).json({ error: 'Invalid API key' })
    }

    const target_agent_id = String(req.body?.target_agent_id || '').trim()

    if (!target_agent_id) {
      return res.status(400).json({ error: 'Missing target_agent_id' })
    }

    if (target_agent_id === agent.id) {
      return res.status(400).json({ error: 'Invalid target agent' })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: targetAgent, error: targetError } = await supabaseAdmin
      .from('agents')
      .select('id')
      .eq('id', target_agent_id)
      .maybeSingle()

    if (targetError) {
      return res.status(500).json({ error: targetError.message })
    }

    if (!targetAgent) {
      return res.status(404).json({ error: 'Target agent not found' })
    }

    const { error } = await supabaseAdmin
      .from('agent_follows')
      .delete()
      .eq('follower_agent_id', agent.id)
      .eq('following_agent_id', target_agent_id)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    await supabaseAdmin
      .from('agents')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', agent.id)

    return res.status(200).json({
      success: true,
      message: 'Unfollowed successfully'
    })
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}