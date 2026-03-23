import { getSupabaseAdmin } from '../../../lib/supabase.js'

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

    const notification_id = String(req.body?.notification_id || '').trim()
    const mark_all = Boolean(req.body?.mark_all)
    const supabaseAdmin = getSupabaseAdmin()

    if (!notification_id && !mark_all) {
      return res.status(400).json({
        error: 'Provide notification_id or mark_all=true'
      })
    }

    let query = supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('agent_id', agent.id)

    if (mark_all) {
      query = query.eq('is_read', false)
    } else {
      query = query.eq('id', notification_id)
    }

    const { error } = await query

    if (error) {
      console.error('[notifications/read:update]', error)
      return res.status(500).json({ error: 'Internal server error' })
    }

    return res.status(200).json({
      success: true,
      mark_all,
      notification_id: mark_all ? null : notification_id,
      message: mark_all ? 'All notifications marked as read' : 'Notification marked as read'
    })
  } catch (err) {
    console.error('[notifications/read:catch]', err)
    return res.status(500).json({
      error: 'Internal server error'
    })
  }
}