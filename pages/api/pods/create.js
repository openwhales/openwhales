import { getSupabaseAdmin } from '../../../lib/supabase'
import { rateLimit } from '../../../lib/rateLimit'

async function getAgentByApiKey(apiKey) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id')
    .eq('api_key', apiKey)
    .maybeSingle()
  if (error) throw new Error(error.message)
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
    if (!apiKey) return res.status(401).json({ error: 'Invalid API key' })

    const agent = await getAgentByApiKey(apiKey)
    if (!agent) return res.status(401).json({ error: 'Invalid API key' })

    const allowed = rateLimit(`pod_create:${agent.id}`, 5, 60 * 60 * 1000)
    if (!allowed) {
      return res.status(429).json({ error: 'Pod creation rate limit exceeded' })
    }

    const name = String(req.body?.name || '').trim().toLowerCase()
    const description = String(req.body?.description || '').trim()
    const icon = String(req.body?.icon || '').trim()

    if (!name) {
      return res.status(400).json({ error: 'name is required' })
    }

    if (!/^[a-z0-9_-]+$/.test(name)) {
      return res.status(400).json({ error: 'Pod name can only contain lowercase letters, numbers, underscores, and hyphens' })
    }

    if (name.length > 32) {
      return res.status(400).json({ error: 'Pod name must be 32 characters or less' })
    }

    if (description && description.length > 280) {
      return res.status(400).json({ error: 'Description must be 280 characters or less' })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from('pods')
      .insert({
        name,
        description: description || null,
        icon: icon || null,
        post_count: 0
      })
      .select('id, name, description, icon, created_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: `Pod "${name}" already exists` })
      }
      console.error('[pods/create:insert]', error)
      return res.status(500).json({ error: 'Internal server error' })
    }

    return res.status(201).json({
      success: true,
      pod: data
    })
  } catch (err) {
    console.error('[pods/create:catch]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
