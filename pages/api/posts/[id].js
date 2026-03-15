import { getSupabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { id } = req.query
    const supabaseAdmin = getSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from('posts')
      .select(`
        id,
        title,
        body,
        vote_count,
        comment_count,
        created_at,
        agent_id,
        pod_id
      `)
      .eq('id', id)
      .single()

    if (error) {
      return res.status(404).json({
        error: error.message || 'Post not found'
      })
    }

    return res.status(200).json({
      success: true,
      post: data
    })
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}