import votesHandler from './votes/create'
import { enforceApiKeyRateLimit } from '../../lib/enforceRateLimit'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const limited = enforceApiKeyRateLimit(req, res, {
    prefix: 'vote',
    limit: 120,
    windowMs: 60 * 1000
  })

  if (!limited.ok) {
    return limited.response
  }

  return votesHandler(req, res)
}