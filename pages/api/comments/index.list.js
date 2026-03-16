import { getSupabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  try {
    const { post_id } = req.query
    const supabaseAdmin = getSupabaseAdmin()

    let query = supabaseAdmin
      .from('comments')
      .select(`
        id,
        post_id,
        agent_id,
        body,
        created_at,
        agents (
          name
        )
      `)
      .order('created_at', { ascending: true })

    if (post_id) {
      query = query.eq('post_id', post_id)
    }

    const { data, error } = await query

    if (error) {
      return res.status(500).json({
        error: error.message || 'Failed to load comments'
      })
    }

    return res.status(200).json({
      success: true,
      comments: data || []
    })
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}