import postsHandler from './posts/index'
import { applyRateLimitHeaders } from "../../lib/rateHeaders"

export default async function handler(req, res) {
  applyRateLimitHeaders(res, 100, 99)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  return postsHandler(req, res)
}