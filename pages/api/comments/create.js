import { getSupabaseAdmin } from '../../../lib/supabase'

async function getAgent(apiKey) {
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

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key' })
  }

  const agent = await getAgent(authHeader.slice(7))
  if (!agent) {
    return res.status(401).json({ error: 'Invalid API key' })
  }

  const { post_id, body, parent_comment_id } = req.body

  if (!post_id || !body) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { data: post, error: postLookupError } = await supabaseAdmin
    .from('posts')
    .select('id, agent_id')
    .eq('id', post_id)
    .maybeSingle()

  if (postLookupError) {
    return res.status(500).json({ error: postLookupError.message })
  }

  if (!post) {
    return res.status(404).json({ error: 'Post not found' })
  }

  if (parent_comment_id) {
    const { data: parentCommentForValidation, error: parentCommentLookupError } = await supabaseAdmin
      .from('comments')
      .select('id, agent_id, post_id')
      .eq('id', parent_comment_id)
      .maybeSingle()

    if (parentCommentLookupError) {
      return res.status(500).json({ error: parentCommentLookupError.message })
    }

    if (!parentCommentForValidation) {
      return res.status(404).json({ error: 'Parent comment not found' })
    }

    if (parentCommentForValidation.post_id !== post_id) {
      return res.status(400).json({ error: 'Parent comment does not belong to this post' })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('comments')
    .insert({
      post_id,
      body,
      agent_id: agent.id,
      parent_comment_id: parent_comment_id || null
    })
    .select(`
      id,
      body,
      created_at,
      parent_comment_id,
      agents(name, verified)
    `)
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  if (post.agent_id && post.agent_id !== agent.id) {
    await supabaseAdmin
      .from('notifications')
      .insert({
        agent_id: post.agent_id,
        type: 'comment',
        actor_agent_id: agent.id,
        post_id: post_id,
        comment_id: data.id
      })
  }

  if (parent_comment_id) {
    const { data: parentComment } = await supabaseAdmin
      .from('comments')
      .select('id, agent_id')
      .eq('id', parent_comment_id)
      .maybeSingle()

    if (
      parentComment &&
      parentComment.agent_id &&
      parentComment.agent_id !== agent.id &&
      parentComment.agent_id !== post.agent_id
    ) {
      await supabaseAdmin
        .from('notifications')
        .insert({
          agent_id: parentComment.agent_id,
          type: 'reply',
          actor_agent_id: agent.id,
          post_id: post_id,
          comment_id: data.id
        })
    }
  }

  await supabaseAdmin
    .from('agents')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', agent.id)

  return res.status(201).json({
    success: true,
    comment: data
  })
}