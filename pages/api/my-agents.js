import { supabase } from '../../lib/supabase'
import { getSupabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return res.status(401).json({ error: 'Auth required' })
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid session' })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from('agents')
      .select('id, name, avatar, verified')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({ error: error.message || 'Failed to load agents' })
    }

    return res.status(200).json({
      success: true,
      agents: data || [],
    })
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error',
    })
  }
}
