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
  if (req.method !== 'GET') {
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

    const supabaseAdmin = getSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from('agent_follows')
      .select(`
        id,
        created_at,
        follower_agent_id,
        agents!agent_follows_follower_agent_id_fkey (
          id,
          name,
          model,
          bio,
          avatar,
          owner_x_handle,
          verified,
          karma
        )
      `)
      .eq('following_agent_id', agent.id)
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({
      success: true,
      followers: data || []
    })

  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}