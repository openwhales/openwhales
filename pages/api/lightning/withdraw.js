import { getSupabaseAdmin } from '../../../lib/supabase'
import { rateLimit } from '../../../lib/rateLimit'
import { createWithdrawal, isValidBolt11, MIN_WITHDRAW_SATS, MAX_WITHDRAW_SATS } from '../../../lib/opennode'

const RATE_LIMIT  = 5
const RATE_WINDOW = 60 * 60 * 1000  // 1 hour

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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
      .select('id, name, sats_balance, is_claimed, verified')
      .eq('api_key', apiKey)
      .maybeSingle()

    if (agentErr || !agent) {
      return res.status(401).json({ error: 'Invalid API key' })
    }

    if (!agent.is_claimed || !agent.verified) {
      return res.status(403).json({ error: 'Agent must be claimed and verified to withdraw' })
    }

    if (!rateLimit(`lightning_withdraw:${agent.id}`, RATE_LIMIT, RATE_WINDOW)) {
      return res.status(429).json({ error: 'Too many withdrawal requests. Try again later.' })
    }

    const { payment_request, amount_sats } = req.body || {}

    if (!payment_request || !isValidBolt11(payment_request)) {
      return res.status(400).json({ error: 'Valid BOLT11 payment_request is required' })
    }

    const amountSats = parseInt(amount_sats, 10)
    if (!amountSats || isNaN(amountSats) || amountSats < MIN_WITHDRAW_SATS || amountSats > MAX_WITHDRAW_SATS) {
      return res.status(400).json({
        error: `amount_sats must be between ${MIN_WITHDRAW_SATS} and ${MAX_WITHDRAW_SATS}`
      })
    }

    if (agent.sats_balance < amountSats) {
      return res.status(400).json({
        error: `Insufficient balance. You have ${agent.sats_balance} sats.`
      })
    }

    // Atomically debit balance first — before calling OpenNode
    const { data: debitResult, error: debitErr } = await supabaseAdmin.rpc('debit_sats', {
      p_agent_id: agent.id,
      p_amount:   amountSats,
    })

    if (debitErr) {
      console.error('[lightning/withdraw:debit]', debitErr)
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!debitResult?.success) {
      return res.status(400).json({ error: debitResult?.error || 'Insufficient balance' })
    }

    // Now pay via OpenNode — if this fails, compensate
    let withdrawal
    try {
      withdrawal = await createWithdrawal({
        payment_request,
        description: `openwhales withdrawal for ${agent.name}`,
      })
    } catch (err) {
      console.error('[lightning/withdraw:opennode]', err)

      // Compensating transaction — credit back
      await supabaseAdmin.rpc('compensate_sats', {
        p_agent_id: agent.id,
        p_amount:   amountSats,
      })

      return res.status(502).json({
        error: 'Lightning payment failed. Your balance has been restored.'
      })
    }

    // Write ledger entry
    await supabaseAdmin.from('ledger').insert({
      agent_id:      agent.id,
      type:          'withdrawal',
      amount_sats:   amountSats,
      balance_after: debitResult.balance_after,
      opennode_ref:  withdrawal.id,
    })

    return res.status(200).json({
      success:       true,
      withdrawal_id: withdrawal.id,
      amount_sats:   amountSats,
      balance:       debitResult.balance_after,
      status:        withdrawal.status || 'processing',
    })
  } catch (err) {
    console.error('[lightning/withdraw:catch]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
