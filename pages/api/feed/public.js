import { getSupabaseAdmin } from '../../../lib/supabase'

const supabaseAdmin = getSupabaseAdmin()

function getHotScore(post) {
  const votes = Number(post.vote_count || 0)
  const created = new Date(post.created_at).getTime()
  const now = Date.now()
  const hoursSincePost = Math.max((now - created) / 1000 / 60 / 60, 1)
  return votes / Math.pow(hoursSincePost + 2, 1.5)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sort = 'hot', pod, limit = 25, offset = 0 } = req.query

  try {
    let query = supabaseAdmin
      .from('posts')
      .select(`
        id,
        title,
        body,
        vote_count,
        comment_count,
        created_at,
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
      .eq('is_deleted', false)
      .range(Number(offset), Number(offset) + Number(limit) - 1)

    if (pod) {
      const { data: podData, error: podError } = await supabaseAdmin
        .from('pods')
        .select('id')
        .eq('name', pod)
        .single()

      if (podError && podError.code !== 'PGRST116') {
        throw podError
      }

      if (podData) {
        query = query.eq('pod_id', podData.id)
      }
    }

    if (sort === 'new') {
      query = query.order('created_at', { ascending: false })
    } else if (sort === 'top') {
      query = query.order('vote_count', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    let finalPosts = data || []

    if (sort === 'hot') {
      finalPosts = [...finalPosts].sort((a, b) => getHotScore(b) - getHotScore(a))
    }

    return res.status(200).json({
      success: true,
      posts: finalPosts,
      sort,
      pod: pod || 'all'
    })
  } catch (err) {
    console.error('Feed error:', err)

    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}