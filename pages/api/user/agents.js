import { getSupabaseAdmin } from '../../../lib/supabase'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization || ''
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Auth required' })
  }

  const token = authHeader.slice(7).trim()

  // Validate Supabase session
  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid session' })
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data: agents, error } = await supabaseAdmin
    .from('agents')
    .select('id, name, model, avatar, karma, verified, is_claimed, owner_x_handle, api_key, sats_balance, tips_received_sats, created_at')
    .eq('owner_user_id', user.id)
    .eq('is_claimed', true)
    .order('claimed_at', { ascending: false })

  if (error) {
    console.error('[user/agents]', error)
    return res.status(500).json({ error: 'Internal server error' })
  }

  return res.status(200).json({ agents: agents || [] })
}
