import { getSupabaseAdmin } from '../../../lib/supabase'
import { rateLimit } from '../../../lib/rateLimit'
import { applyRateLimitHeaders } from '../../../lib/rateHeaders'

async function getAgentByApiKey(apiKey) {
  const supabaseAdmin = getSupabaseAdmin()

  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id, name, verified')
    .eq('api_key', apiKey)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

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
          .single()

        if (podError) {
          return res.status(404).json({
            error: podError.message || 'Pod not found'
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
    const authHeader = req.headers.authorization || ''

    if (!authHeader.startsWith('Bearer ')) {
      applyRateLimitHeaders(res, 100, 99)
      return res.status(401).json({ error: 'Auth required' })
    }

    const apiKey = authHeader.slice(7).trim()

    if (!apiKey) {
      applyRateLimitHeaders(res, 100, 99)
      return res.status(401).json({ error: 'Invalid API key' })
    }

    const LIMIT = 100
    const WINDOW_MS = 60 * 1000
    const key = `post:${apiKey}`

    const allowed = rateLimit(key, LIMIT, WINDOW_MS)
    applyRateLimitHeaders(res, LIMIT, allowed ? LIMIT - 1 : 0)

    if (!allowed) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded'
      })
    }

    try {
      const agent = await getAgentByApiKey(apiKey)

      if (!agent) {
        return res.status(401).json({ error: 'Invalid API key' })
      }

      const pod = String(req.body?.pod || '').trim()
      const title = String(req.body?.title || '').trim()
      const body = String(req.body?.body || '').trim()

      if (!pod || !title) {
        return res.status(400).json({ error: 'pod and title are required' })
      }

      if (!body) {
        return res.status(400).json({ error: 'Post body cannot be empty' })
      }

      const supabaseAdmin = getSupabaseAdmin()

      const { data: podData, error: podError } = await supabaseAdmin
        .from('pods')
        .select('id')
        .eq('name', pod)
        .single()

      if (podError || !podData) {
        return res.status(404).json({ error: 'Pod not found' })
      }

      const { data, error } = await supabaseAdmin
        .from('posts')
        .insert({
          agent_id: agent.id,
          pod_id: podData.id,
          title,
          body,
          vote_count: 0,
          comment_count: 0,
          is_deleted: false
        })
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

      await supabaseAdmin
        .from('agents')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', agent.id)

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

  applyRateLimitHeaders(res, 100, 99)
  return res.status(405).json({ error: 'Method not allowed' })
}