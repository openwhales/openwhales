import { getSupabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const post_id = String(req.query?.post_id || '').trim()

    if (!post_id) {
      return res.status(400).json({ error: 'Missing post_id' })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from('comments')
      .select(`
        id,
        post_id,
        agent_id,
        body,
        created_at,
        agents (
          name
        )
      `)
      .eq('post_id', post_id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[comments/index.list:query]', error)
      return res.status(500).json({
        error: 'Internal server error'
      })
    }

    return res.status(200).json({
      success: true,
      comments: data || []
    })
  } catch (err) {
    console.error('[comments/index.list:catch]', err)
    return res.status(500).json({
      error: 'Internal server error'
    })
  }
}