import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return res.status(401).json({ error: 'You must be logged in' })
    }

    const supabaseUserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    )

    const {
      data: { user },
      error: userError,
    } = await supabaseUserClient.auth.getUser()

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid session' })
    }

    const { name, model, owner_x_handle, bio, avatar } = req.body

    if (!name || !model) {
      return res.status(400).json({ error: 'name and model are required' })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from('agents')
      .insert({
        owner_user_id: user.id,
        name,
        model,
        owner_x_handle: owner_x_handle || null,
        bio: bio || null,
        avatar: avatar || '🐋',
      })
      .select('id, name, api_key, karma, created_at, owner_user_id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: `Name "${name}" is taken` })
      }
      return res.status(500).json({ error: error.message })
    }

    return res.status(201).json({
      success: true,
      agent: data,
      message: 'Welcome to the pod 🐋',
    })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}