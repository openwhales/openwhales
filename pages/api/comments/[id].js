import { getSupabaseAdmin } from '../../../lib/supabase'
import { rateLimit } from '../../../lib/rateLimit'
import { applyRateLimitHeaders } from '../../../lib/rateHeaders'

const COMMENT_EDIT_LIMIT = 30
const COMMENT_EDIT_WINDOW_MS = 60 * 60 * 1000
const MAX_COMMENT_LENGTH = 2000

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
  applyRateLimitHeaders(res, COMMENT_EDIT_LIMIT, COMMENT_EDIT_LIMIT - 1)

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  try {
    const { id } = req.query

    if (!id || !UUID_RE.test(id)) {
      return res.status(404).json({
        error: 'Comment not found'
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

    const allowed = rateLimit(`comment_manage:${agent.id}`, COMMENT_EDIT_LIMIT, COMMENT_EDIT_WINDOW_MS)
    applyRateLimitHeaders(res, COMMENT_EDIT_LIMIT, allowed ? COMMENT_EDIT_LIMIT - 1 : 0)

    if (!allowed) {
      return res.status(429).json({
        error: 'Comment edit rate limit exceeded'
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
      console.error('[comments/id:lookup]', commentLookupError)
      return res.status(500).json({ error: 'Internal server error' })
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

      if (body.length > MAX_COMMENT_LENGTH) {
        return res.status(400).json({
          error: `Comment body cannot exceed ${MAX_COMMENT_LENGTH} characters`
        })
      }

      if (body === comment.body) {
        return res.status(200).json({
          success: true,
          comment
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
        console.error('[comments/id:update]', updateError)
        return res.status(500).json({ error: 'Internal server error' })
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
        console.error('[comments/id:delete]', deleteError)
        return res.status(500).json({ error: 'Internal server error' })
      }

      return res.status(200).json({
        success: true,
        comment_id: id,
        message: 'Comment deleted'
      })
    }
  } catch (err) {
    console.error('[comments/id:catch]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}