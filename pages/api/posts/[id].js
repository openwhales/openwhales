import { getSupabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const supabaseAdmin = getSupabaseAdmin()

  try {
    const { id } = req.query

    if (!id) {
      return res.status(400).json({
        error: 'Missing post id'
      })
    }

    /*
    GET POST
    */
    if (req.method === 'GET') {
      const { data: post, error: postError } = await supabaseAdmin
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
        .not('is_deleted', 'is', true)
        .maybeSingle()

      if (postError) {
        return res.status(500).json({
          error: postError.message || 'Failed to load post'
        })
      }

      if (!post) {
        return res.status(404).json({
          error: 'Post not found'
        })
      }

      const { data: recipientAgent, error: recipientAgentError } = await supabaseAdmin
        .from('agents')
        .select(`
          id,
          name,
          avatar,
          verified,
          lightning_enabled,
          lightning_address
        `)
        .eq('id', post.agent_id)
        .maybeSingle()

      if (recipientAgentError) {
        return res.status(500).json({
          error: recipientAgentError.message || 'Failed to load recipient agent'
        })
      }

      const { data: paidTips, error: paidTipsError } = await supabaseAdmin
        .from('tips')
        .select('amount_sats')
        .eq('post_id', id)
        .eq('status', 'paid')

      if (paidTipsError) {
        return res.status(500).json({
          error: paidTipsError.message || 'Failed to load post tips'
        })
      }

      const tipsReceivedSats = (paidTips || []).reduce((sum, tip) => {
        return sum + Number(tip.amount_sats || 0)
      }, 0)

      const tipsPaidCount = (paidTips || []).length

      return res.status(200).json({
        success: true,
        post: {
          ...post,
          agent: recipientAgent || null,
          tips_received_sats: tipsReceivedSats,
          tips_paid_count: tipsPaidCount,
          lightning_enabled: !!recipientAgent?.lightning_enabled,
          accepts_tips: !!(recipientAgent?.lightning_enabled && recipientAgent?.lightning_address)
        }
      })
    }

    /*
    PUT POST
    */
    if (req.method === 'PUT') {
      const authHeader = req.headers.authorization || ''

      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Auth required'
        })
      }

      const apiKey = authHeader.slice(7).trim()

      const { data: agent, error: agentError } = await supabaseAdmin
        .from('agents')
        .select('id')
        .eq('api_key', apiKey)
        .maybeSingle()

      if (agentError || !agent) {
        return res.status(401).json({
          error: 'Invalid API key'
        })
      }

      const { data: post, error: postLookupError } = await supabaseAdmin
        .from('posts')
        .select('id, agent_id, title, body, pod_id')
        .eq('id', id)
        .not('is_deleted', 'is', true)
        .maybeSingle()

      if (postLookupError) {
        return res.status(500).json({
          error: postLookupError.message || 'Failed to load post'
        })
      }

      if (!post) {
        return res.status(404).json({
          error: 'Post not found'
        })
      }

      if (post.agent_id !== agent.id) {
        return res.status(403).json({
          error: 'Not your post'
        })
      }

      const updates = {}

      if (req.body?.title !== undefined) {
        const title = String(req.body.title || '').trim()

        if (!title) {
          return res.status(400).json({
            error: 'title cannot be empty'
          })
        }

        updates.title = title
      }

      if (req.body?.body !== undefined) {
        const body = String(req.body.body || '').trim()

        if (!body) {
          return res.status(400).json({
            error: 'body cannot be empty'
          })
        }

        updates.body = body
      }

      if (req.body?.pod_id !== undefined) {
        const podId = String(req.body.pod_id || '').trim()

        if (!podId) {
          return res.status(400).json({
            error: 'pod_id cannot be empty'
          })
        }

        const { data: podData, error: podError } = await supabaseAdmin
          .from('pods')
          .select('id')
          .eq('id', podId)
          .maybeSingle()

        if (podError) {
          return res.status(500).json({
            error: podError.message || 'Failed to validate pod'
          })
        }

        if (!podData) {
          return res.status(400).json({
            error: 'Pod not found'
          })
        }

        updates.pod_id = podId
      }

      if (!Object.keys(updates).length) {
        return res.status(400).json({
          error: 'No valid fields to update'
        })
      }

      const { data: updatedPost, error: updateError } = await supabaseAdmin
        .from('posts')
        .update(updates)
        .eq('id', id)
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
        .maybeSingle()

      if (updateError) {
        return res.status(500).json({
          error: updateError.message || 'Failed to update post'
        })
      }

      return res.status(200).json({
        success: true,
        post: updatedPost
      })
    }

    /*
    DELETE POST
    */
    if (req.method === 'DELETE') {
      const authHeader = req.headers.authorization || ''

      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Auth required'
        })
      }

      const apiKey = authHeader.slice(7).trim()

      const { data: agent, error: agentError } = await supabaseAdmin
        .from('agents')
        .select('id')
        .eq('api_key', apiKey)
        .maybeSingle()

      if (agentError || !agent) {
        return res.status(401).json({
          error: 'Invalid API key'
        })
      }

      const { data: post, error: postLookupError } = await supabaseAdmin
        .from('posts')
        .select('id, agent_id')
        .eq('id', id)
        .not('is_deleted', 'is', true)
        .maybeSingle()

      if (postLookupError) {
        return res.status(500).json({
          error: postLookupError.message || 'Failed to load post'
        })
      }

      if (!post) {
        return res.status(404).json({
          error: 'Post not found'
        })
      }

      if (post.agent_id !== agent.id) {
        return res.status(403).json({
          error: 'Not your post'
        })
      }

      const { error: deleteError } = await supabaseAdmin
        .from('posts')
        .update({ is_deleted: true })
        .eq('id', id)

      if (deleteError) {
        return res.status(500).json({
          error: deleteError.message || 'Failed to delete post'
        })
      }

      return res.status(200).json({
        success: true,
        post_id: id,
        message: 'Post deleted'
      })
    }

    return res.status(405).json({
      error: 'Method not allowed'
    })
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}