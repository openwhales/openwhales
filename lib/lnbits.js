/**
 * LNbits API client — replaces OpenNode, no KYC required.
 *
 * Set these env vars in Vercel:
 *   LNBITS_URL       — e.g. https://lnbits.com  (or your self-hosted instance)
 *   LNBITS_ADMIN_KEY — Admin key from your LNbits wallet (Wallet → API Keys)
 */

const LNBITS_URL      = (process.env.LNBITS_URL || 'https://lnbits.com').replace(/\/$/, '')
const LNBITS_ADMIN_KEY = process.env.LNBITS_ADMIN_KEY

// Limits
export const MIN_DEPOSIT_SATS  = 100
export const MAX_DEPOSIT_SATS  = 10_000_000
export const MIN_WITHDRAW_SATS = 1_000
export const MAX_WITHDRAW_SATS = 10_000_000

async function lnbitsRequest(method, path, body) {
  if (!LNBITS_ADMIN_KEY) throw new Error('LNBITS_ADMIN_KEY not configured')

  const res = await fetch(`${LNBITS_URL}${path}`, {
    method,
    headers: {
      'X-Api-Key':    LNBITS_ADMIN_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const json = await res.json()

  if (!res.ok) {
    const msg = json?.detail || json?.message || `LNbits HTTP ${res.status}`
    throw new Error(msg)
  }

  return json
}

/**
 * Create a Lightning deposit invoice.
 * Returns: { payment_hash, payment_request, checking_id }
 *
 * `payment_hash` is what we store as our charge ID — it's the unique identifier
 * LNbits sends back in the webhook when the invoice is paid.
 */
export async function createInvoice({ amount_sats, memo, webhook_url }) {
  return lnbitsRequest('POST', '/api/v1/payments', {
    out:     false,
    amount:  amount_sats,   // LNbits accepts sats directly
    memo:    memo || 'openwhales deposit',
    webhook: webhook_url,   // LNbits POSTs here when paid
  })
}

/**
 * Pay a BOLT11 invoice (withdrawal).
 * Returns: { payment_hash, checking_id, fee_msat }
 */
export async function payInvoice({ payment_request }) {
  return lnbitsRequest('POST', '/api/v1/payments', {
    out:    true,
    bolt11: payment_request,
  })
}

/**
 * Check payment status — used to verify a webhook is legitimate.
 * Returns: { paid: bool, details: { ... } }
 */
export async function getPayment(payment_hash) {
  return lnbitsRequest('GET', `/api/v1/payments/${payment_hash}`)
}

/**
 * Validate a BOLT11 invoice string format.
 * lnbc = mainnet, lntb = testnet, lnbcrt = regtest
 */
export function isValidBolt11(str) {
  return typeof str === 'string' && /^ln(bc|tb|bcrt)[0-9a-zA-Z]+$/i.test(str.trim())
}
