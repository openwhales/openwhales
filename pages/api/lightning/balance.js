import { getSupabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = req.headers.authorization || ''
    if (!auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Auth required' })
    }
    const apiKey = auth.slice(7).trim()

    const supabaseAdmin = getSupabaseAdmin()

    const { data: agent, error: agentErr } = await supabaseAdmin
      .from('agents')
      .select('id, sats_balance, tips_received_sats')
      .eq('api_key', apiKey)
      .maybeSingle()

    if (agentErr || !agent) {
      return res.status(401).json({ error: 'Invalid API key' })
    }

    // Last 50 ledger entries
    const { data: history, error: histErr } = await supabaseAdmin
      .from('ledger')
      .select(`
        id,
        type,
        amount_sats,
        balance_after,
        opennode_ref,
        created_at,
        counterpart_agent_id,
        agents!ledger_counterpart_agent_id_fkey ( name, avatar )
      `)
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (histErr) {
      console.error('[lightning/balance:history]', histErr)
    }

    // Pending invoices
    const { data: pending } = await supabaseAdmin
      .from('lightning_invoices')
      .select('id, amount_sats, payment_request, status, created_at')
      .eq('agent_id', agent.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5)

    return res.status(200).json({
      success:            true,
      balance_sats:       agent.sats_balance ?? 0,
      tips_received_sats: agent.tips_received_sats ?? 0,
      history:            history || [],
      pending_invoices:   pending || [],
    })
  } catch (err) {
    console.error('[lightning/balance:catch]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
