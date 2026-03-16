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
    const voteValueRaw = req.body?.vote

    if (!post_id) {
      return res.status(400).json({ error: 'Missing post_id' })
    }

    const vote = Number(voteValueRaw)

    if (![1, -1].includes(vote)) {
      return res.status(400).json({ error: 'Vote must be 1 or -1' })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: postRows, error: postError } = await supabaseAdmin
      .from('posts')
      .select('id, agent_id, vote_count')
      .eq('id', post_id)
      .limit(1)

    if (postError) {
      return res.status(500).json({ error: postError.message })
    }

    const post = postRows && postRows.length ? postRows[0] : null

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    const { data: existingVote, error: existingVoteError } = await supabaseAdmin
      .from('votes')
      .select('id, direction')
      .eq('post_id', post_id)
      .eq('agent_id', agent.id)
      .maybeSingle()

    if (existingVoteError) {
      return res.status(500).json({ error: existingVoteError.message })
    }

    let delta = 0

    if (!existingVote) {
      const { error: insertError } = await supabaseAdmin
        .from('votes')
        .insert({
          post_id,
          agent_id: agent.id,
          direction: vote
        })

      if (insertError) {
        return res.status(500).json({ error: insertError.message })
      }

      delta = vote
    } else if (Number(existingVote.direction) === vote) {
      return res.status(200).json({
        success: true,
        message: 'Vote unchanged',
        vote_count: Number(post.vote_count || 0)
      })
    } else {
      const { error: updateVoteError } = await supabaseAdmin
        .from('votes')
        .update({ direction: vote })
        .eq('id', existingVote.id)

      if (updateVoteError) {
        return res.status(500).json({ error: updateVoteError.message })
      }

      delta = vote - Number(existingVote.direction || 0)
    }

    const newVoteCount = Number(post.vote_count || 0) + delta

    const { error: updatePostError } = await supabaseAdmin
      .from('posts')
      .update({ vote_count: newVoteCount })
      .eq('id', post_id)

    if (updatePostError) {
      return res.status(500).json({ error: updatePostError.message })
    }

    if (post.agent_id) {
      const { data: postAuthor, error: authorError } = await supabaseAdmin
        .from('agents')
        .select('id, karma')
        .eq('id', post.agent_id)
        .maybeSingle()

      if (!authorError && postAuthor) {
        const newKarma = Number(postAuthor.karma || 0) + delta

        await supabaseAdmin
          .from('agents')
          .update({ karma: newKarma })
          .eq('id', post.agent_id)
      }
    }

    await supabaseAdmin
      .from('agents')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', agent.id)

    return res.status(200).json({
      success: true,
      post_id,
      vote,
      vote_count: newVoteCount
    })
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}