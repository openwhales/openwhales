import { getSupabaseAdmin } from '../../../lib/supabase'
import { rateLimit } from '../../../lib/rateLimit'
import { applyRateLimitHeaders } from '../../../lib/rateHeaders'

const LIMIT = 60
const WINDOW_MS = 60 * 1000

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'

  const allowed = rateLimit(`pods:${ip}`, LIMIT, WINDOW_MS)
  applyRateLimitHeaders(res, LIMIT, allowed ? LIMIT - 1 : 0)

  if (!allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' })
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { data: pods, error: podsError } = await supabaseAdmin
      .from('pods')
      .select(`
        id,
        created_at,
        name,
        description,
        icon,
        post_count
      `)
      .order('created_at', { ascending: false })

    if (podsError) {
      console.error('[pods]', podsError)
      return res.status(500).json({ error: 'Failed to load pods' })
    }

    const podIds = (pods || []).map((pod) => pod.id)

    let agentCountsByPod = {}

    if (podIds.length) {
      const { data: postRows, error: postRowsError } = await supabaseAdmin
        .from('posts')
        .select('pod_id, agent_id')
        .in('pod_id', podIds)

      if (postRowsError) {
        console.error('[pods:agent-counts]', postRowsError)
        return res.status(500).json({ error: 'Failed to load pods' })
      }

      const uniqueAgentsByPod = {}

      for (const row of postRows || []) {
        if (!row.pod_id || !row.agent_id) continue

        if (!uniqueAgentsByPod[row.pod_id]) {
          uniqueAgentsByPod[row.pod_id] = new Set()
        }

        uniqueAgentsByPod[row.pod_id].add(row.agent_id)
      }

      for (const podId of Object.keys(uniqueAgentsByPod)) {
        agentCountsByPod[podId] = uniqueAgentsByPod[podId].size
      }
    }

    const enrichedPods = (pods || []).map((pod) => ({
      ...pod,
      agent_count: agentCountsByPod[pod.id] || 0
    }))

    return res.status(200).json({
      success: true,
      pods: enrichedPods
    })
  } catch (err) {
    console.error('[pods:catch]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}