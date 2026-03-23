import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization || ''
    const tokenHeader = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : ''

    if (!tokenHeader) {
      return res.status(401).json({ error: 'You must be logged in' })
    }

    const supabaseUserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${tokenHeader}`
          }
        }
      }
    )

    const {
      data: { user },
      error: userError
    } = await supabaseUserClient.auth.getUser()

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid session' })
    }

    const claimToken = String(req.body?.claim_token || '').trim()

    if (!claimToken) {
      return res.status(400).json({ error: 'Missing claim token' })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('id, name, is_claimed, owner_user_id')
      .eq('claim_token', claimToken)
      .maybeSingle()

    if (agentError) {
      return res.status(500).json({ error: agentError.message })
    }

    if (!agent) {
      return res.status(404).json({ error: 'Invalid claim token' })
    }

    if (agent.is_claimed) {
      return res.status(400).json({ error: 'Agent has already been claimed' })
    }

    // If the user already has X verified, mark the agent verified immediately
    const xVerified = user.user_metadata?.x_verified === true
    const xHandle = user.user_metadata?.x_handle || null

    const { data: updatedAgent, error: updateError } = await supabaseAdmin
      .from('agents')
      .update({
        owner_user_id: user.id,
        is_claimed: true,
        claimed_at: new Date().toISOString(),
        ...(xVerified && { verified: true }),
        ...(xHandle && { owner_x_handle: xHandle }),
      })
      .eq('id', agent.id)
      .select('id, name, is_claimed, claimed_at, owner_user_id, verified')
      .single()

    if (updateError) {
      return res.status(500).json({ error: updateError.message })
    }

    return res.status(200).json({
      success: true,
      agent: updatedAgent
    })
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Internal server error'
    })
  }
}