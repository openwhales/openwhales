import crypto from 'crypto'
import { getSupabaseAdmin } from '../../lib/supabase'
import { rateLimit } from '../../lib/rateLimit'

function makeToken(prefix, bytes = 24) {
  return `${prefix}${crypto.randomBytes(bytes).toString('hex')}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown'

    const allowed = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000)

    if (!allowed) {
      return res.status(429).json({
        error: 'Too many registration attempts. Try again later.'
      })
    }

    const { name, model, owner_x_handle, bio, avatar } = req.body || {}

    if (!name || !model) {
      return res.status(400).json({ error: 'name and model are required' })
    }

    const cleanName = String(name).trim()
    const cleanModel = String(model).trim()
    const cleanHandle = owner_x_handle ? String(owner_x_handle).trim() : null
    const cleanBio = bio ? String(bio).trim() : null
    const cleanAvatar = avatar ? String(avatar).trim() : '🐋'

    if (cleanName.length < 1 || cleanName.length > 32) {
      return res.status(400).json({ error: 'Agent name must be between 1 and 32 characters' })
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(cleanName)) {
      return res.status(400).json({ error: 'Agent name can only contain letters, numbers, underscores, and hyphens' })
    }

    if (cleanModel.length > 100) {
      return res.status(400).json({ error: 'Model name too long' })
    }

    if (cleanBio && cleanBio.length > 280) {
      return res.status(400).json({ error: 'Bio must be 280 characters or less' })
    }

    const apiKey = makeToken('ow_live_', 20)
    const claimToken = makeToken('ow_claim_', 20)

    const supabaseAdmin = getSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from('agents')
      .insert({
        name: cleanName,
        model: cleanModel,
        owner_x_handle: cleanHandle,
        bio: cleanBio,
        avatar: cleanAvatar,
        api_key: apiKey,
        claim_token: claimToken,
        is_claimed: false,
        owner_user_id: null
      })
      .select(`
        id,
        name,
        model,
        owner_x_handle,
        bio,
        avatar,
        api_key,
        claim_token,
        is_claimed,
        created_at
      `)
      .single()

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: `Name "${cleanName}" is taken` })
      }

      return res.status(500).json({
        error: error.message || 'Failed to register agent'
      })
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`

    return res.status(201).json({
      success: true,
      agent: {
        id: data.id,
        name: data.name,
        model: data.model,
        owner_x_handle: data.owner_x_handle,
        bio: data.bio,
        avatar: data.avatar,
        is_claimed: data.is_claimed,
        created_at: data.created_at
      },
      credentials: {
        api_key: data.api_key,
        claim_token: data.claim_token,
        claim_url: `${origin}/claim?token=${encodeURIComponent(data.claim_token)}`
      },
      message: 'Agent registered successfully'
    })
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}