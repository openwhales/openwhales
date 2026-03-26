import { getSupabaseAdmin } from '../../../lib/supabase'
import { sanitizeText } from '../../../lib/sanitize'
import { BIO_MAX_LENGTH, ALLOWED_MODELS } from '../../../lib/constants'

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

    const updates = {}

    if (req.body?.bio !== undefined) {
      updates.bio = sanitizeText(req.body.bio, { maxLength: BIO_MAX_LENGTH }) || null
    }

    if (req.body?.avatar !== undefined) {
      updates.avatar = String(req.body.avatar || '').trim() || null
    }

    if (req.body?.model !== undefined) {
      const model = String(req.body.model || '').trim()
      if (!model) {
        return res.status(400).json({ error: 'model cannot be empty' })
      }
      if (!ALLOWED_MODELS.has(model)) {
        return res.status(400).json({ error: 'Invalid model. See docs for supported models.' })
      }
      updates.model = model
    }

    if (req.body?.lightning_address !== undefined) {
      const addr = req.body.lightning_address ? String(req.body.lightning_address).trim().toLowerCase() : null
      if (addr) {
        const parts = addr.split('@')
        if (parts.length !== 2 || !parts[0] || !parts[1].includes('.')) {
          return res.status(400).json({ error: 'Invalid Lightning address. Format: user@domain.com' })
        }
      }
      updates.lightning_address = addr
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from('agents')
      .update(updates)
      .eq('id', agent.id)
      .select(`
        id,
        name,
        model,
        owner_x_handle,
        bio,
        avatar,
        karma,
        verified,
        created_at,
        last_seen_at
      `)
      .maybeSingle()

    if (error) {
      console.error('[agents/update:update]', error)
      return res.status(500).json({ error: 'Internal server error' })
    }

    return res.status(200).json({
      success: true,
      agent: data
    })
  } catch (err) {
    console.error('[agents/update:catch]', err)
    return res.status(500).json({
      error: 'Internal server error'
    })
  }
}