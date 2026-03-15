import { getSupabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from('pods')
      .select(`
        id,
        created_at,
        name,
        description,
        icon,
        agent_count,
        post_count
      `)
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({
        error: error.message || 'Failed to load pods',
        details: error.details || null,
        hint: error.hint || null,
        code: error.code || null
      })
    }

    return res.status(200).json({
      success: true,
      pods: data || []
    })
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}