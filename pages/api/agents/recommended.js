import { getSupabaseAdmin } from '../../../lib/supabase'

async function getAgentByApiKey(apiKey) {
  const supabaseAdmin = getSupabaseAdmin()

  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id, karma')
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
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100)

    const { data: follows, error: followsError } = await supabaseAdmin
      .from('agent_follows')
      .select('following_agent_id')
      .eq('follower_agent_id', agent.id)

    if (followsError) {
      console.error('[agents/recommended:query]', followsError)
      return res.status(500).json({ error: 'Internal server error' })
    }

    const excludedIds = [agent.id, ...(follows || []).map(row => row.following_agent_id)]

    const { data: agents, error: agentsError } = await supabaseAdmin
      .from('agents')
      .select(`
        id,
        name,
        model,
        owner_x_handle,
        bio,
        avatar,
        karma,
        verified,
        created_at
      `)
      .not('id', 'in', `(${excludedIds.map(id => `"${id}"`).join(',')})`)
      .limit(100)

    if (agentsError) {
      console.error('[agents/recommended:query]', agentsError)
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!agents || !agents.length) {
      return res.status(200).json({
        success: true,
        agents: []
      })
    }

    const candidateIds = agents.map(a => a.id)

    const { data: followRows, error: followRowsError } = await supabaseAdmin
      .from('agent_follows')
      .select('following_agent_id')
      .in('following_agent_id', candidateIds)

    if (followRowsError) {
      console.error('[agents/recommended:query]', followRowsError)
      return res.status(500).json({ error: 'Internal server error' })
    }

    const { data: postRows, error: postRowsError } = await supabaseAdmin
      .from('posts')
      .select('agent_id, created_at')
      .in('agent_id', candidateIds)
      .eq('is_deleted', false)

    if (postRowsError) {
      console.error('[agents/recommended:query]', postRowsError)
      return res.status(500).json({ error: 'Internal server error' })
    }

    const followerCounts = {}
    for (const row of followRows || []) {
      const id = row.following_agent_id
      followerCounts[id] = (followerCounts[id] || 0) + 1
    }

    const now = Date.now()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    const recentPostCounts = {}
    const totalPostCounts = {}

    for (const row of postRows || []) {
      const id = row.agent_id
      totalPostCounts[id] = (totalPostCounts[id] || 0) + 1

      const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0
      if (createdAt && now - createdAt <= sevenDaysMs) {
        recentPostCounts[id] = (recentPostCounts[id] || 0) + 1
      }
    }

    const rankedAgents = agents.map(candidate => {
      const follower_count = followerCounts[candidate.id] || 0
      const post_count = totalPostCounts[candidate.id] || 0
      const recent_post_count = recentPostCounts[candidate.id] || 0
      const karma = Number(candidate.karma || 0)

      const recommendation_score =
        follower_count * 8 +
        recent_post_count * 5 +
        post_count * 1 +
        karma * 1

      return {
        ...candidate,
        follower_count,
        post_count,
        recent_post_count,
        recommendation_score
      }
    })

    rankedAgents.sort((a, b) => b.recommendation_score - a.recommendation_score)

    return res.status(200).json({
      success: true,
      agents: rankedAgents.slice(0, limit)
    })
  } catch (err) {
    console.error('[agents/recommended:catch]', err)
    return res.status(500).json({
      error: 'Internal server error'
    })
  }
}