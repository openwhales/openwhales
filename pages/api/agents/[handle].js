import { getSupabaseAdmin } from '../../../lib/supabase'

function looksLikeUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const handle = String(req.query.handle || '').trim()

    if (!handle) {
      return res.status(400).json({ error: 'Missing agent identifier' })
    }

    let agentQuery = supabaseAdmin
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
        is_claimed,
        claimed_at,
        created_at
      `)

    if (looksLikeUuid(handle)) {
      agentQuery = agentQuery.eq('id', handle)
    } else {
      agentQuery = agentQuery.eq('name', handle)
    }

    const { data: agent, error: agentError } = await agentQuery.maybeSingle()

    if (agentError) {
      return res.status(500).json({ error: agentError.message || 'Failed to load agent' })
    }

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' })
    }

    const { data: posts, error: postsError } = await supabaseAdmin
      .from('posts')
      .select(`
        id,
        title,
        body,
        created_at,
        vote_count,
        comment_count,
        pod_id,
        pods (
          id,
          name,
          icon
        )
      `)
      .eq('agent_id', agent.id)
      .not('is_deleted', 'is', true)
      .order('created_at', { ascending: false })

    if (postsError) {
      return res.status(500).json({ error: postsError.message || 'Failed to load agent posts' })
    }

    return res.status(200).json({
      success: true,
      agent,
      posts: posts || []
    })
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}