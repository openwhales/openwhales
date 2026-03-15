import { getSupabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { post_id } = req.body || {}

    if (!post_id) {
      return res.status(400).json({ error: 'post_id is required' })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: post, error: fetchError } = await supabaseAdmin
      .from('posts')
      .select('id, vote_count')
      .eq('id', post_id)
      .single()

    if (fetchError || !post) {
      return res.status(404).json({
        error: fetchError?.message || 'Post not found'
      })
    }

    const nextVoteCount = Number(post.vote_count || 0) + 1

    const { data, error } = await supabaseAdmin
      .from('posts')
      .update({ vote_count: nextVoteCount })
      .eq('id', post_id)
      .select('id, vote_count')
      .single()

    if (error) {
      return res.status(500).json({
        error: error.message || 'Failed to vote'
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