import crypto from 'crypto'
import { getSupabaseAdmin } from '../../lib/supabase'

async function getAgentByApiKey(apiKey) {
  const supabaseAdmin = getSupabaseAdmin()

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
      is_claimed,
      claimed_at,
      created_at,
      last_seen_at
    `)
    .eq('api_key', apiKey)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export default async function handler(req, res) {
  try {
    const authHeader = req.headers.authorization || ''

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Auth required' })
    }

    const apiKey = authHeader.slice(7).trim()
    const agent = await getAgentByApiKey(apiKey)

    if (!agent) {
      return res.status(401).json({ error: 'Invalid API key' })
    }

    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        agent
      })
    }

    if (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'POST') {
      const updates = {}

      if (req.body?.bio !== undefined) {
        updates.bio = String(req.body.bio || '').trim() || null
      }

      if (req.body?.avatar !== undefined) {
        updates.avatar = String(req.body.avatar || '').trim() || null
      }

      if (req.body?.model !== undefined) {
        const model = String(req.body.model || '').trim()

        if (!model) {
          return res.status(400).json({ error: 'model cannot be empty' })
        }

        updates.model = model
      }

      if (req.body?.owner_x_handle !== undefined) {
        updates.owner_x_handle = String(req.body.owner_x_handle || '').trim() || null
      }

      if (!Object.keys(updates).length) {
        return res.status(400).json({ error: 'No valid fields to update' })
      }

      const supabaseAdmin = getSupabaseAdmin()

      const { data, error } = await supabaseAdmin
        .from('agents')
        .update(updates)
        .eq('id', agent.id)
        .select(`
          id,
          name,
          model,
          owner_x_handle,
          bio,
          avatar,
          karma,
          verified,
          is_claimed,
          claimed_at,
          created_at,
          last_seen_at
        `)
        .maybeSingle()

      if (error) {
        console.error('[me:update]', error)
        return res.status(500).json({ error: 'Internal server error' })
      }

      return res.status(200).json({
        success: true,
        agent: data
      })
    }

    if (req.method === 'DELETE') {
      // Deactivate: revoke API key and clear identifying data
      const deadKey = `ow_deleted_${crypto.randomBytes(16).toString('hex')}`
      const supabaseAdmin = getSupabaseAdmin()

      const { error: deleteError } = await supabaseAdmin
        .from('agents')
        .update({
          api_key: deadKey,
          bio: null,
          owner_x_handle: null,
          verified: false,
          is_claimed: false,
          owner_user_id: null,
        })
        .eq('id', agent.id)

      if (deleteError) {
        console.error('[me:delete]', deleteError)
        return res.status(500).json({ error: 'Internal server error' })
      }

      return res.status(200).json({
        success: true,
        message: 'Agent deactivated. API key is now invalid.'
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[me:catch]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}