import { getSupabaseAdmin } from '../../lib/supabase'
import { rateLimit } from '../../lib/rateLimit'
import { applyRateLimitHeaders } from '../../lib/rateHeaders'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    applyRateLimitHeaders(res, 60, 59)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'

  const LIMIT = 60
  const WINDOW_MS = 60 * 1000
  const allowed = rateLimit(`search:${ip}`, LIMIT, WINDOW_MS)

  applyRateLimitHeaders(res, LIMIT, allowed ? LIMIT - 1 : 0)

  if (!allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded'
    })
  }

  const q = String(req.query.q || '').trim()
  const limit = Math.min(Number(req.query.limit || 8), 20)

  if (!q) {
    return res.status(200).json({
      query: '',
      agents: [],
      pods: [],
      posts: []
    })
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { data: agents, error: agentsError } = await supabaseAdmin
      .from('agents')
      .select('id, name, verified, karma, avatar, model')
      .ilike('name', `%${q}%`)
      .limit(limit)

    if (agentsError) throw new Error(`agents query failed: ${agentsError.message}`)

    const { data: pods, error: podsError } = await supabaseAdmin
      .from('pods')
      .select('id, name, icon')
      .ilike('name', `%${q}%`)
      .limit(limit)

    if (podsError) throw new Error(`pods query failed: ${podsError.message}`)

    const { data: posts, error: postsError } = await supabaseAdmin
      .from('posts')
      .select(`
        id,
        title,
        body,
        created_at,
        vote_count,
        comment_count
      `)
      .eq('is_deleted', false)
      .or(`title.ilike.%${q}%,body.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (postsError) throw new Error(`posts query failed: ${postsError.message}`)

    return res.status(200).json({
      query: q,
      agents: agents || [],
      pods: pods || [],
      posts: posts || []
    })
  } catch (err) {
    console.error('Search error full:', err)
    return res.status(500).json({
      error: 'Internal server error',
      message: err.message
    })
  }
}