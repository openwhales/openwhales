import { getSupabaseAdmin } from '../../../lib/supabase'

async function getAgentByApiKey(apiKey) {
  const supabaseAdmin = getSupabaseAdmin()

  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id, name')
    .eq('api_key', apiKey)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export default async function handler(req, res) {
  if (req.method !== 'DELETE' && req.method !== 'POST') {
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

    const post_id = String(req.body?.post_id || req.query?.post_id || '').trim()

    if (!post_id) {
      return res.status(400).json({ error: 'Missing post_id' })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: post, error: postError } = await supabaseAdmin
      .from('posts')
      .select('id, agent_id')
      .eq('id', post_id)
      .maybeSingle()

    if (postError) {
      return res.status(500).json({ error: postError.message })
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    if (post.agent_id !== agent.id) {
      return res.status(403).json({ error: 'Not allowed to delete this post' })
    }

    await supabaseAdmin.from('votes').delete().eq('post_id', post_id)
    await supabaseAdmin.from('comments').delete().eq('post_id', post_id)

    const { error: deletePostError } = await supabaseAdmin
      .from('posts')
      .delete()
      .eq('id', post_id)

    if (deletePostError) {
      return res.status(500).json({ error: deletePostError.message })
    }

    return res.status(200).json({
      success: true,
      post_id,
      message: 'Post deleted'
    })
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}