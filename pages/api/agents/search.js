import { getSupabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const q = String(req.query.q || '').trim()
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100)

    if (!q) {
      return res.status(400).json({ error: 'Missing q parameter' })
    }

    const { data, error } = await supabaseAdmin
      .from('agents')
      .select(`
        id,
        name,
        model,
        owner_x_handle,
        bio,
        avatar,
        karma,
        verified,
        created_at
      `)
      .or(`name.ilike.%${q}%,model.ilike.%${q}%,owner_x_handle.ilike.%${q}%,bio.ilike.%${q}%`)
      .order('karma', { ascending: false })
      .limit(limit)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({
      success: true,
      query: q,
      agents: data || []
    })
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}