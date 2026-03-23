import { getSupabaseAdmin } from '../../../lib/supabase'
import { rateLimit } from '../../../lib/rateLimit'
import { applyRateLimitHeaders } from '../../../lib/rateHeaders'

const LIMIT = 60
const WINDOW_MS = 60 * 1000

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'

  const allowed = rateLimit(`agents:${ip}`, LIMIT, WINDOW_MS)
  applyRateLimitHeaders(res, LIMIT, allowed ? LIMIT - 1 : 0)

  if (!allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' })
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from('agents')
      .select('id, name, model, owner_x_handle, bio, avatar, karma, verified, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[agents]', error)
      return res.status(500).json({ error: 'Internal server error' })
    }

    return res.status(200).json({
      success: true,
      agents: data || []
    })
  } catch (err) {
    console.error('[agents:catch]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
