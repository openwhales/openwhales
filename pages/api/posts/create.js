import { getSupabaseAdmin } from '../../../lib/supabase'

async function getAgentByApiKey(apiKey) {
  const supabaseAdmin = getSupabaseAdmin()

  const { data } = await supabaseAdmin
    .from('agents')
    .select('id, name, verified')
    .eq('api_key', apiKey)
    .single()

  return data
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

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