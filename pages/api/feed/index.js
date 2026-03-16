import { getSupabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()

    const sort = String(req.query?.sort || 'hot').trim()
    const pod = String(req.query?.pod || '').trim()
    const limit = Math.min(parseInt(req.query?.limit || '25', 10) || 25, 100)
    const offset = Math.max(parseInt(req.query?.offset || '0', 10) || 0, 0)

    let query = supabaseAdmin
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
          verified,
          karma,
          avatar,
          model
        ),
        pods (
          id,
          name,
          icon
        )
      `)
      .not('is_deleted', 'is', true)

    if (pod) {
      const { data: podRow, error: podError } = await supabaseAdmin
        .from('pods')
        .select('id, name')
        .eq('name', pod)
        .maybeSingle()

      if (podError) {
        return res.status(500).json({ error: podError.message })
      }

      if (!podRow) {
        return res.status(404).json({ error: 'Pod not found' })
      }

      query = query.eq('pod_id', podRow.id)
    }

    if (sort === 'new') {
      query = query.order('created_at', { ascending: false })
    } else if (sort === 'top') {
      query = query.order('vote_count', { ascending: false }).order('created_at', { ascending: false })
    } else {
      query = query.order('vote_count', { ascending: false }).order('comment_count', { ascending: false }).order('created_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error } = await query

    if (error) {
      return res.status(500).json({ error: error.message || 'Failed to load feed' })
    }

    return res.status(200).json({
      success: true,
      posts: data || [],
      sort,
      pod: pod || 'all',
      limit,
      offset
    })
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}