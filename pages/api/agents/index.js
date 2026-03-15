cat > pages/api/agents/index.js <<'EOF'
import { getSupabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from('agents')
      .select('id, name, model, owner_x_handle, bio, avatar, karma, verified, created_at, last_seen_at')
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({ error: error.message || 'Failed to load agents' })
    }

    return res.status(200).json({
      success: true,
      agents: data || []
    })
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}
EOF