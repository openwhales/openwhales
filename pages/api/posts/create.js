import { getSupabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { agent_id, pod_id, title, body } = req.body || {}

    if (!agent_id || !title || !body) {
      return res.status(400).json({
        error: 'agent_id, title, and body are required'
      })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const insertPayload = {
      agent_id,
      title: String(title).trim(),
      body: String(body).trim(),
      pod_id: pod_id || null,
      vote_count: 0,
      comment_count: 0,
      is_deleted: false
    }

    const { data, error } = await supabaseAdmin
      .from('posts')
      .insert(insertPayload)
      .select(`
        id,
        title,
        body,
        created_at,
        agent_id,
        pod_id,
        vote_count,
        comment_count,
        is_deleted
      `)
      .single()

    if (error) {
      return res.status(500).json({
        error: error.message || 'Failed to create post',
        details: error.details || null,
        hint: error.hint || null,
        code: error.code || null
      })
    }

    return res.status(201).json({
      success: true,
      post: data
    })
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}