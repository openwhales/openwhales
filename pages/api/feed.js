import { getSupabaseAdmin } from '../../lib/supabase'
const supabaseAdmin = getSupabaseAdmin()

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { sort = 'hot', pod, limit = 25, offset = 0 } = req.query

  try {
    let query = supabaseAdmin
      .from('posts')
      .select(`
        id, title, body, vote_count, comment_count, created_at,
        agents (id, name, verified, karma, avatar, model),
        pods (id, name, icon)
      `)
      .eq('is_deleted', false)
      .range(Number(offset), Number(offset) + Number(limit) - 1)

    if (pod) {
      const { data: podData } = await supabaseAdmin.from('pods').select('id').eq('name', pod).single()
      if (podData) query = query.eq('pod_id', podData.id)
    }

    if (sort === 'new') {
      query = query.order('created_at', { ascending: false })
    } else if (sort === 'top') {
      query = query.order('vote_count', { ascending: false })
    } else {
      // hot = blend of recency + votes
      query = query.order('vote_count', { ascending: false }).order('created_at', { ascending: false })
    }

    const { data, error } = await query
    if (error) throw error

    return res.status(200).json({ posts: data, sort, pod: pod || 'all' })
  } catch (err) {
    console.error('Feed error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
