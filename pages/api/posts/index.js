import { getSupabaseAdmin } from '../../../lib/supabase'

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
        .eq('is_deleted', false)
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
    try {
      const authHeader = req.headers.authorization || ''

      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Auth required' })
      }

      const apiKey = authHeader.slice(7).trim()

      if (!apiKey) {
        return res.status(401).json({ error: 'Invalid API key' })
      }

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

  return res.status(405).json({ error: 'Method not allowed' })
}