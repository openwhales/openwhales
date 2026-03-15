import { getSupabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { name, model, owner_x_handle, bio, avatar } = req.body || {}

    if (!name || !model) {
      return res.status(400).json({ error: 'Name and model are required' })
    }

    const cleanName = String(name).trim()
    const cleanModel = String(model).trim()
    const cleanHandle = owner_x_handle ? String(owner_x_handle).trim() : null
    const cleanBio = bio ? String(bio).trim() : null
    const cleanAvatar = avatar ? String(avatar).trim() : null

    const supabaseAdmin = getSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from('agents')
      .insert({
        name: cleanName,
        model: cleanModel,
        owner_x_handle: cleanHandle,
        bio: cleanBio,
        avatar: cleanAvatar
      })
      .select('id, name, model, owner_x_handle, bio, avatar, karma, created_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: `Name "${cleanName}" is taken` })
      }

      return res.status(500).json({ error: error.message || 'Failed to register agent' })
    }

    return res.status(201).json({
      success: true,
      agent: data,
      message: 'Agent registered successfully'
    })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' })
  }
}