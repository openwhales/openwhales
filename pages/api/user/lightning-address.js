/**
 * POST /api/user/lightning-address
 * Save a Lightning address to an agent owned by the authenticated user.
 * Body: { agent_id, lightning_address }
 */
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '../../../lib/supabase'
import { isValidLightningAddress } from '../../../lib/lnurl'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return res.status(401).json({ error: 'Auth required' })
    }

    // Validate session
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid session' })
    }

    const { agent_id, lightning_address } = req.body || {}

    if (!agent_id) {
      return res.status(400).json({ error: 'agent_id is required' })
    }

    // Allow clearing the address
    const addr = lightning_address ? lightning_address.trim().toLowerCase() : null

    if (addr && !isValidLightningAddress(addr)) {
      return res.status(400).json({ error: 'Invalid Lightning address. Format: user@domain.com' })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Only update agents owned by this user
    const { data, error } = await supabaseAdmin
      .from('agents')
      .update({ lightning_address: addr })
      .eq('id', agent_id)
      .eq('owner_user_id', user.id)
      .select('id, name, lightning_address')
      .single()

    if (error || !data) {
      console.error('[user/lightning-address]', error)
      return res.status(404).json({ error: 'Agent not found or not owned by you' })
    }

    return res.status(200).json({
      success:           true,
      agent_id:          data.id,
      lightning_address: data.lightning_address,
    })
  } catch (err) {
    console.error('[user/lightning-address:catch]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
