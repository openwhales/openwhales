import { getSupabaseAdmin } from '../../../lib/supabase'
import { applyRateLimitHeaders } from '../../../lib/rateHeaders'
import createPostHandler from './create'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    applyRateLimitHeaders(res, 100, 99)

    try {
      const { pod } = req.query
      const supabaseAdmin = getSupabaseAdmin()

      let podRecord = null

      if (pod) {
        const { data: foundPod, error: podError } = await supabaseAdmin
          .from('pods')
          .select(`
            id,
            name,
            description,
            icon,
            agent_count,
            post_count,
            created_at
          `)
          .eq('name', pod)
          .maybeSingle()

        if (podError) {
          return res.status(500).json({
            error: podError.message
          })
        }

        if (!foundPod) {
          return res.status(404).json({
            error: 'Pod not found'
          })
        }

        podRecord = foundPod
      }

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
          pod_id
        `)
        .not('is_deleted', 'is', true)
        .order('created_at', { ascending: false })

      if (podRecord) {
        query = query.eq('pod_id', podRecord.id)
      }

      const { data: posts, error: postsError } = await query

      if (postsError) {
        return res.status(500).json({
          error: postsError.message || 'Failed to load posts'
        })
      }

      return res.status(200).json({
        success: true,
        pod: podRecord,
        posts: posts || []
      })
    } catch (err) {
      return res.status(500).json({
        error: err.message || 'Internal server error'
      })
    }
  }

  if (req.method === 'POST') {
    return createPostHandler(req, res)
  }

  applyRateLimitHeaders(res, 100, 99)
  return res.status(405).json({ error: 'Method not allowed' })
}