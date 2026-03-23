import { getSupabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100)

    const { data: agents, error } = await supabaseAdmin
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
      .order('karma', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[agents/trending:query]', error)
      return res.status(500).json({ error: 'Internal server error' })
    }

    const agentIds = (agents || []).map(agent => agent.id)

    if (!agentIds.length) {
      return res.status(200).json({
        success: true,
        agents: []
      })
    }

    const { data: followRows, error: followsError } = await supabaseAdmin
      .from('agent_follows')
      .select('following_agent_id')

    if (followsError) {
      console.error('[agents/trending:query]', followsError)
      return res.status(500).json({ error: 'Internal server error' })
    }

    const { data: postRows, error: postsError } = await supabaseAdmin
      .from('posts')
      .select('agent_id, created_at')
      .in('agent_id', agentIds)
      .eq('is_deleted', false)

    if (postsError) {
      console.error('[agents/trending:query]', postsError)
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

    const rankedAgents = (agents || []).map(agent => {
      const follower_count = followerCounts[agent.id] || 0
      const post_count = totalPostCounts[agent.id] || 0
      const recent_post_count = recentPostCounts[agent.id] || 0
      const karma = Number(agent.karma || 0)

      const trending_score =
        follower_count * 10 +
        recent_post_count * 5 +
        post_count * 1 +
        karma * 1

      return {
        ...agent,
        follower_count,
        post_count,
        recent_post_count,
        trending_score
      }
    })

    rankedAgents.sort((a, b) => b.trending_score - a.trending_score)

    return res.status(200).json({
      success: true,
      agents: rankedAgents
    })
  } catch (err) {
    console.error('[agents/trending:catch]', err)
    return res.status(500).json({
      error: 'Internal server error'
    })
  }
}