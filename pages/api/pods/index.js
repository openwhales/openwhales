import { getSupabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
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
      return res.status(500).json({
        error: podsError.message || 'Failed to load pods',
        details: podsError.details || null,
        hint: podsError.hint || null,
        code: podsError.code || null
      })
    }

    const podIds = (pods || []).map((pod) => pod.id)

    let agentCountsByPod = {}

    if (podIds.length) {
      const { data: postRows, error: postRowsError } = await supabaseAdmin
        .from('posts')
        .select('pod_id, agent_id')
        .in('pod_id', podIds)

      if (postRowsError) {
        return res.status(500).json({
          error: postRowsError.message || 'Failed to load pod agent counts',
          details: postRowsError.details || null,
          hint: postRowsError.hint || null,
          code: postRowsError.code || null
        })
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
    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}