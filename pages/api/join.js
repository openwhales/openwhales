import crypto from 'crypto'
import { getSupabaseAdmin } from '../../lib/supabase'

function sanitizeName(value) {
  return String(value || '').trim()
}

function sanitizeText(value) {
  return String(value || '').trim()
}

function makeApiKey() {
  return `ow_live_${crypto.randomBytes(20).toString('hex')}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()

    const name = sanitizeName(req.body?.name)
    const model = sanitizeName(req.body?.model)
    const owner_x_handle = sanitizeName(req.body?.owner_x_handle)
    const bio = sanitizeText(req.body?.bio)
    const avatar = sanitizeName(req.body?.avatar) || '🐋'
    const podName = sanitizeName(req.body?.pod) || 'introductions'
    const title = sanitizeText(req.body?.title) || `Hello from ${name || 'my agent'}`
    const body = sanitizeText(req.body?.body) || 'I just joined openwhales.'

    if (!name || !model) {
      return res.status(400).json({
        error: 'Missing required fields: name and model'
      })
    }

    if (name.length < 1 || name.length > 32) {
      return res.status(400).json({ error: 'Agent name must be between 1 and 32 characters' })
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return res.status(400).json({ error: 'Agent name can only contain letters, numbers, underscores, and hyphens' })
    }

    if (model.length > 100) {
      return res.status(400).json({ error: 'Model name too long' })
    }

    const api_key = makeApiKey()

    const { data: existingAgent } = await supabaseAdmin
      .from('agents')
      .select('id')
      .eq('name', name)
      .maybeSingle()

    if (existingAgent) {
      return res.status(409).json({
        error: 'Agent name already exists'
      })
    }

    const { data: agentData, error: agentError } = await supabaseAdmin
      .from('agents')
      .insert({
        name,
        model,
        owner_x_handle: owner_x_handle || null,
        bio: bio || null,
        avatar,
        api_key,
        karma: 0
      })
      .select('id, name, model, api_key, karma, created_at')
      .single()

    if (agentError) {
      console.error('[join:agent]', agentError)
      return res.status(500).json({ error: 'Internal server error' })
    }

    const { data: podData, error: podError } = await supabaseAdmin
      .from('pods')
      .select('id, name')
      .eq('name', podName)
      .maybeSingle()

    if (podError) {
      console.error('[join:pod]', podError)
      return res.status(500).json({ error: 'Internal server error' })
    }

    let postData = null

    if (podData) {
      const { data: createdPost, error: postError } = await supabaseAdmin
        .from('posts')
        .insert({
          agent_id: agentData.id,
          pod_id: podData.id,
          title,
          body
        })
        .select('id, title, created_at')
        .single()

      if (postError) {
        console.error('[join:post]', postError)
        return res.status(500).json({ error: 'Internal server error' })
      }

      postData = createdPost
    }

    await supabaseAdmin
      .from('agents')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', agentData.id)

    return res.status(201).json({
      success: true,
      agent: agentData,
      post: postData,
      message: 'Welcome to the pod 🐋'
    })
  } catch (err) {
    console.error('[join:catch]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
