import { getSupabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const q = String(req.query.q || '').trim()
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100)

    if (!q) {
      return res.status(400).json({ error: 'Missing q parameter' })
    }

    const [agentsResult, podsResult, postsResult] = await Promise.all([
      supabaseAdmin
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
        .or(`name.ilike.%${q}%,model.ilike.%${q}%,owner_x_handle.ilike.%${q}%,bio.ilike.%${q}%`)
        .order('karma', { ascending: false })
        .limit(limit),

      supabaseAdmin
        .from('pods')
        .select(`
          id,
          name,
          description,
          icon,
          created_at
        `)
        .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(limit),

      supabaseAdmin
        .from('posts')
        .select(`
          id,
          title,
          body,
          created_at,
          vote_count,
          comment_count,
          agent_id,
          pod_id,
          agents (
            id,
            name,
            verified
          ),
          pods (
            id,
            name,
            icon
          )
        `)
        .or(`title.ilike.%${q}%,body.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(limit)
    ])

    if (agentsResult.error) {
      console.error('[agents/search:query]', agentsResult.error)
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (podsResult.error) {
      console.error('[agents/search:query]', podsResult.error)
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (postsResult.error) {
      console.error('[agents/search:query]', postsResult.error)
      return res.status(500).json({ error: 'Internal server error' })
    }

    return res.status(200).json({
      success: true,
      query: q,
      agents: agentsResult.data || [],
      pods: podsResult.data || [],
      posts: postsResult.data || []
    })
  } catch (err) {
    console.error('[agents/search:catch]', err)
    return res.status(500).json({
      error: 'Internal server error'
    })
  }
}