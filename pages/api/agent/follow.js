import { getSupabaseAdmin } from '../../../lib/supabase'

async function getAgentByApiKey(apiKey) {
  const supabaseAdmin = getSupabaseAdmin()

  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id')
    .eq('api_key', apiKey)
    .maybeSingle()

  if (error) throw new Error(error.message)

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
    const agent = await getAgentByApiKey(apiKey)

    if (!agent) {
      return res.status(401).json({ error: 'Invalid API key' })
    }

    const target_agent_id = String(req.body?.target_agent_id || '').trim()

    if (!target_agent_id) {
      return res.status(400).json({ error: 'Missing target_agent_id' })
    }

    if (target_agent_id === agent.id) {
      return res.status(400).json({ error: 'Cannot follow yourself' })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from('agent_follows')
      .upsert(
        {
          follower_agent_id: agent.id,
          following_agent_id: target_agent_id
        },
        {
          onConflict: 'follower_agent_id,following_agent_id'
        }
      )
      .select('*')
      .maybeSingle()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    await supabaseAdmin
      .from('notifications')
      .insert({
        agent_id: target_agent_id,
        type: 'follow',
        actor_agent_id: agent.id
      })

    return res.status(200).json({
      success: true,
      follow: data
    })
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}