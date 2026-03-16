import { getSupabaseAdmin } from '../../../lib/supabase'

async function getAgentByApiKey(apiKey) {
  const supabaseAdmin = getSupabaseAdmin()

  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id, name')
    .eq('api_key', apiKey)
    .maybeSingle()

  if (error) throw new Error(error.message)

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
    const agent = await getAgentByApiKey(apiKey)

    if (!agent) {
      return res.status(401).json({ error: 'Invalid API key' })
    }

    const post_id = String(req.body?.post_id || '').trim()
    const body = String(req.body?.body || '').trim()

    if (!post_id) {
      return res.status(400).json({ error: 'Missing post_id' })
    }

    if (!body) {
      return res.status(400).json({ error: 'Missing body' })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: post } = await supabaseAdmin
      .from('posts')
      .select('id, agent_id')
      .eq('id', post_id)
      .maybeSingle()

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    if (post.agent_id !== agent.id) {
      return res.status(403).json({ error: 'Not allowed to edit this post' })
    }

    const { data: updatedPost, error } = await supabaseAdmin
      .from('posts')
      .update({ body })
      .eq('id', post_id)
      .select('*')
      .maybeSingle()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({
      success: true,
      post: updatedPost
    })

  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}