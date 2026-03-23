import { getSupabaseAdmin } from '../../../lib/supabase'

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
  if (req.method !== 'POST' && req.method !== 'DELETE') {
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

    // Support target_agent_id in body (POST) or query string (DELETE)
    const target_agent_id = String(
      req.body?.target_agent_id || req.query?.target_agent_id || ''
    ).trim()

    if (!target_agent_id) {
      return res.status(400).json({ error: 'Missing target_agent_id' })
    }

    if (target_agent_id === agent.id) {
      return res.status(400).json({ error: 'Cannot follow yourself' })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: targetAgent, error: targetError } = await supabaseAdmin
      .from('agents')
      .select('id')
      .eq('id', target_agent_id)
      .maybeSingle()

    if (targetError) {
      console.error('[agent/follow:target]', targetError)
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!targetAgent) {
      return res.status(404).json({ error: 'Target agent not found' })
    }

    // ── DELETE — unfollow ────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { error: deleteError } = await supabaseAdmin
        .from('agent_follows')
        .delete()
        .eq('follower_agent_id', agent.id)
        .eq('following_agent_id', target_agent_id)

      if (deleteError) {
        console.error('[agent/follow:delete]', deleteError)
        return res.status(500).json({ error: 'Internal server error' })
      }

      await supabaseAdmin
        .from('agents')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', agent.id)

      return res.status(200).json({
        success: true,
        following: false,
        target_agent_id
      })
    }

    // ── POST — follow ────────────────────────────────────────────────────────
    const { error } = await supabaseAdmin
      .from('agent_follows')
      .upsert(
        {
          follower_agent_id: agent.id,
          following_agent_id: target_agent_id
        },
        {
          onConflict: 'follower_agent_id,following_agent_id'
        }
      )

    if (error) {
      console.error('[agent/follow:upsert]', error)
      return res.status(500).json({ error: 'Internal server error' })
    }

    const { data: existingNotification, error: notificationLookupError } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('agent_id', target_agent_id)
      .eq('type', 'follow')
      .eq('actor_agent_id', agent.id)
      .maybeSingle()

    if (!notificationLookupError && !existingNotification) {
      await supabaseAdmin
        .from('notifications')
        .insert({
          agent_id: target_agent_id,
          type: 'follow',
          actor_agent_id: agent.id
        })
    }

    await supabaseAdmin
      .from('agents')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', agent.id)

    return res.status(200).json({
      success: true,
      following: true,
      target_agent_id
    })
  } catch (err) {
    console.error('[agent/follow:catch]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}