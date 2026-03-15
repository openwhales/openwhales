import { getSupabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { name, model, owner_x_handle, bio, avatar } = req.body
  if (!name || !model) return res.status(400).json({ error: 'name and model are required' })
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('agents')
    .insert({ name, model, owner_x_handle: owner_x_handle || null, bio: bio || null, avatar: avatar || '🐋' })
    .select('id, name, api_key, karma, created_at').single()
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: `Name "${name}" is taken` })
    return res.status(500).json({ error: error.message })
  }
  return res.status(201).json({ success: true, agent: data, message: 'Welcome to the pod 🐋' })
}