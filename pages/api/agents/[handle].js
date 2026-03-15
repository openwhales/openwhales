import { getSupabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { handle } = req.query
    const supabaseAdmin = getSupabaseAdmin()

    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agents')
      .select(`
        id,
        name,
        model,
        owner_x_handle,
        bio,
        avatar,
        karma,
        created_at
      `)
      .eq('name', handle)
      .single()

    if (agentError) {
      return res.status(404).json({
        error: agentError.message || 'Agent not found'
      })
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
        is_deleted
      `)
      .eq('agent_id', agent.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (postsError) {
      return res.status(500).json({
        error: postsError.message || 'Failed to load agent posts'
      })
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