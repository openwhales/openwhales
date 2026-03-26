import crypto from 'crypto'

const OPENNODE_API_KEY = process.env.OPENNODE_API_KEY
const OPENNODE_BASE = 'https://api.opennode.com'

// Limits
export const MIN_DEPOSIT_SATS  = 100
export const MAX_DEPOSIT_SATS  = 10_000_000
export const MIN_WITHDRAW_SATS = 1000   // OpenNode minimum
export const MAX_WITHDRAW_SATS = 10_000_000
export const WITHDRAW_FEE_SATS = 0      // OpenNode charges fees on their end

async function opennodeRequest(method, path, body) {
  if (!OPENNODE_API_KEY) throw new Error('OPENNODE_API_KEY not configured')

  const res = await fetch(`${OPENNODE_BASE}${path}`, {
    method,
    headers: {
      Authorization: OPENNODE_API_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const json = await res.json()

  if (!res.ok) {
    const msg = json?.message || json?.error || `OpenNode HTTP ${res.status}`
    throw new Error(msg)
  }

  return json.data ?? json
}

/**
 * Create a Lightning deposit invoice via OpenNode.
 * Returns: { id, payment_request, lightning_invoice, status, amount, created_at }
 */
export async function createCharge({ amount_sats, description, order_id, callback_url }) {
  return opennodeRequest('POST', '/v1/charges', {
    amount:       amount_sats,
    currency:     'BTC',
    description,
    order_id,     // opaque ref — we use our DB invoice ID
    callback_url, // OpenNode will POST here on payment
    auto_settle:  false,
  })
}

/**
 * Fetch charge status from OpenNode (for polling / reconciliation).
 */
export async function getCharge(chargeId) {
  return opennodeRequest('GET', `/v1/charge/${chargeId}`)
}

/**
 * Pay a Lightning invoice (withdrawal).
 * type: 'ln' for BOLT11 invoice
 * Returns: { id, amount, fee, status, payment_hash }
 */
export async function createWithdrawal({ payment_request, description }) {
  return opennodeRequest('POST', '/v2/withdrawals', {
    type:        'ln',
    address:     payment_request,
    description: description || 'openwhales withdrawal',
  })
}

/**
 * Verify an OpenNode webhook payload.
 * OpenNode sends: { id, status, hashed_order, ... }
 * hashed_order = HMAC-SHA256(charge_id, api_key)
 */
export function verifyWebhook({ id, hashed_order }) {
  if (!OPENNODE_API_KEY) return false
  const expected = crypto
    .createHmac('sha256', OPENNODE_API_KEY)
    .update(id)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(hashed_order, 'hex')
  )
}

/**
 * Decode a BOLT11 invoice amount (naive — just for validation).
 * Returns amount in sats, or null if unable to decode.
 * We don't decode the full BOLT11 spec — we use OpenNode to tell us the amount.
 */
export function isValidBolt11(str) {
  return typeof str === 'string' && /^lnbc[0-9a-zA-Z]+$/i.test(str.trim())
}
