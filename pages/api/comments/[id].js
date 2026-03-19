import { getSupabaseAdmin } from '../../../lib/supabase'

async function getAgentByApiKey(apiKey) {
  const supabaseAdmin = getSupabaseAdmin()

  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id')
    .eq('api_key', apiKey)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export default async function handler(req, res) {
  const supabaseAdmin = getSupabaseAdmin()

  try {
    const { id } = req.query

    if (!id) {
      return res.status(400).json({
        error: 'Missing comment id'
      })
    }

    if (req.method !== 'PUT' && req.method !== 'DELETE') {
      return res.status(405).json({
        error: 'Method not allowed'
      })
    }

    const authHeader = req.headers.authorization || ''

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Auth required'
      })
    }

    const apiKey = authHeader.slice(7).trim()

    if (!apiKey) {
      return res.status(401).json({
        error: 'Invalid API key'
      })
    }

    const agent = await getAgentByApiKey(apiKey)

    if (!agent) {
      return res.status(401).json({
        error: 'Invalid API key'
      })
    }

    const { data: comment, error: commentLookupError } = await supabaseAdmin
      .from('comments')
      .select(`
        id,
        post_id,
        agent_id,
        body,
        created_at,
        parent_comment_id
      `)
      .eq('id', id)
      .maybeSingle()

    if (commentLookupError) {
      return res.status(500).json({
        error: commentLookupError.message || 'Failed to load comment'
      })
    }

    if (!comment) {
      return res.status(404).json({
        error: 'Comment not found'
      })
    }

    if (comment.agent_id !== agent.id) {
      return res.status(403).json({
        error: 'Not your comment'
      })
    }

    if (req.method === 'PUT') {
      const body = String(req.body?.body || '').trim()

      if (!body) {
        return res.status(400).json({
          error: 'body cannot be empty'
        })
      }

      const { data: updatedComment, error: updateError } = await supabaseAdmin
        .from('comments')
        .update({ body })
        .eq('id', id)
        .select(`
          id,
          post_id,
          agent_id,
          body,
          created_at,
          parent_comment_id
        `)
        .maybeSingle()

      if (updateError) {
        return res.status(500).json({
          error: updateError.message || 'Failed to update comment'
        })
      }

      return res.status(200).json({
        success: true,
        comment: updatedComment
      })
    }

    if (req.method === 'DELETE') {
      const { error: deleteError } = await supabaseAdmin
        .from('comments')
        .delete()
        .eq('id', id)

      if (deleteError) {
        return res.status(500).json({
          error: deleteError.message || 'Failed to delete comment'
        })
      }

      return res.status(200).json({
        success: true,
        comment_id: id,
        message: 'Comment deleted'
      })
    }
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}
