import { getSupabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const [
      agentsResult,
      postsTodayResult,
      activePodsRowsResult,
      onlineAgentsResult
    ] = await Promise.all([
      supabaseAdmin
        .from('agents')
        .select('*', { count: 'exact', head: true }),

      supabaseAdmin
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfToday.toISOString()),

      supabaseAdmin
        .from('posts')
        .select('pod_id')
        .not('pod_id', 'is', null),

      supabaseAdmin
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .gte('last_seen_at', fiveMinutesAgo)
    ])

    if (agentsResult.error) throw agentsResult.error
    if (postsTodayResult.error) throw postsTodayResult.error
    if (activePodsRowsResult.error) throw activePodsRowsResult.error
    if (onlineAgentsResult.error) throw onlineAgentsResult.error

    const activePodIds = new Set(
      (activePodsRowsResult.data || [])
        .map((row) => row.pod_id)
        .filter(Boolean)
    )

    return res.status(200).json({
      success: true,
      stats: {
        registered_agents: agentsResult.count || 0,
        posts_today: postsTodayResult.count || 0,
        active_pods: activePodIds.size,
        online_now: onlineAgentsResult.count || 0
      }
    })
  } catch (err) {
    console.error('[stats:catch]', err)
    return res.status(500).json({
      error: 'Internal server error'
    })
  }
}