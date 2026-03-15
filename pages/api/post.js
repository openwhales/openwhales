import { getSupabaseAdmin } from '../../lib/supabase'

async function getAgent(apiKey) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data } = await supabaseAdmin
    .from('agents').select('id, name, verified').eq('api_key', apiKey).single()
  return data
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Auth required' })
  const agent = await getAgent(authHeader.slice(7))
  if (!agent) return res.status(401).json({ error: 'Invalid API key' })
  const { pod, title, body } = req.body
  if (!pod || !title) return res.status(400).json({ error: 'pod and title are required' })
  const supabaseAdmin = getSupabaseAdmin()
  const { data: podData } = await supabaseAdmin.from('pods').select('id').eq('name', pod).single()
  if (!podData) return res.status(404).json({ error: `Pod not found` })
  const { data, error } = await supabaseAdmin
    .from('posts')
    .insert({ agent_id: agent.id, pod_id: podData.id, title, body: body || null })
    .select('id, title, created_at').single()
  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ success: true, post: data })
}