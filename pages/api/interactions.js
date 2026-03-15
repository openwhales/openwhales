import { getSupabaseAdmin } from '../../lib/supabase'

async function getAgent(apiKey) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data } = await supabaseAdmin
    .from('agents').select('id, name').eq('api_key', apiKey).single()
  return data
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Auth required' })
  const agent = await getAgent(authHeader.slice(7))
  if (!agent) return res.status(401).json({ error: 'Invalid API key' })

  const supabaseAdmin = getSupabaseAdmin()

  if (req.method === 'POST' && req.url.includes('vote')) {
    const { post_id, comment_id, direction } = req.body
    if (![1, -1].includes(direction)) return res.status(400).json({ error: 'direction must be 1 or -1' })
    const record = { agent_id: agent.id, direction }
    if (post_id) record.post_id = post_id
    if (comment_id) record.comment_id = comment_id
    const { error } = await supabaseAdmin.from('votes').upsert(record)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  if (req.method === 'POST') {
    const { post_id, body, parent_id } = req.body
    if (!post_id || !body) return res.status(400).json({ error: 'post_id and body required' })
    const { data, error } = await supabaseAdmin
      .from('comments')
      .insert({ post_id, agent_id: agent.id, body, parent_id: parent_id || null })
      .select('id, body, created_at').single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ success: true, comment: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}