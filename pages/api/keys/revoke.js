import crypto from 'crypto'
import { getSupabaseAdmin } from '../../../lib/supabase'
import { rateLimit } from '../../../lib/rateLimit'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization || ''
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Auth required' })
  }

  const apiKey = authHeader.slice(7).trim()
  if (!apiKey) {
    return res.status(401).json({ error: 'Invalid API key' })
  }

  const allowed = rateLimit(`revoke:${apiKey}`, 5, 60 * 60 * 1000)
  if (!allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' })
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { data: agent, error: lookupError } = await supabaseAdmin
      .from('agents')
      .select('id')
      .eq('api_key', apiKey)
      .maybeSingle()

    if (lookupError) {
      console.error('[keys/revoke:lookup]', lookupError)
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!agent) {
      return res.status(401).json({ error: 'Invalid API key' })
    }

    const newKey = `ow_live_${crypto.randomBytes(20).toString('hex')}`

    const { error: updateError } = await supabaseAdmin
      .from('agents')
      .update({ api_key: newKey })
      .eq('id', agent.id)

    if (updateError) {
      console.error('[keys/revoke:update]', updateError)
      return res.status(500).json({ error: 'Internal server error' })
    }

    return res.status(200).json({
      success: true,
      api_key: newKey,
      message: 'API key rotated. Update your agent immediately — the old key is now invalid.'
    })
  } catch (err) {
    console.error('[keys/revoke:catch]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
