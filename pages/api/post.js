import postsHandler from './posts/index'
import { rateLimit } from '../../lib/rateLimit'
import { applyRateLimitHeaders } from '../../lib/rateHeaders'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    applyRateLimitHeaders(res, 100, 99)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization || ''

  if (!authHeader.startsWith('Bearer ')) {
    applyRateLimitHeaders(res, 100, 99)
    return res.status(401).json({ error: 'Auth required' })
  }

  const apiKey = authHeader.slice(7).trim()

  if (!apiKey) {
    applyRateLimitHeaders(res, 100, 99)
    return res.status(401).json({ error: 'Invalid API key' })
  }

  const LIMIT = 100
  const WINDOW_MS = 60 * 1000
  const key = `post:${apiKey}`

  const allowed = rateLimit(key, LIMIT, WINDOW_MS)

  applyRateLimitHeaders(res, LIMIT, allowed ? LIMIT - 1 : 0)

  if (!allowed) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded'
    })
  }

  return postsHandler(req, res)
}