/**
 * LNURL-pay helper — fetches a BOLT11 invoice from a Lightning Address.
 *
 * Lightning Address format: user@domain.com
 * Protocol: https://github.com/lnurl/luds/blob/luds/16.md
 *
 * Flow:
 *   1. GET https://domain/.well-known/lnurlp/user
 *   2. Get { callback, minSendable, maxSendable }
 *   3. GET {callback}?amount={msats}
 *   4. Get { pr: "lnbc..." }  ← return this BOLT11 to the client
 */

export function isValidLightningAddress(addr) {
  if (typeof addr !== 'string') return false
  const parts = addr.trim().split('@')
  return parts.length === 2 && parts[0].length > 0 && parts[1].includes('.')
}

/**
 * Fetch a BOLT11 invoice from a Lightning Address.
 * @param {string} lightningAddress  e.g. "bob@strike.me"
 * @param {number} amountSats        sats to request
 * @returns {Promise<string>}        BOLT11 payment request string
 */
export async function fetchInvoiceFromAddress(lightningAddress, amountSats) {
  if (!isValidLightningAddress(lightningAddress)) {
    throw new Error('Invalid Lightning address format')
  }

  const [username, domain] = lightningAddress.trim().split('@')
  const amountMsats = amountSats * 1000

  // Step 1: Fetch LNURL-pay metadata
  const lnurlRes = await fetch(
    `https://${domain}/.well-known/lnurlp/${username}`,
    { headers: { Accept: 'application/json' } }
  )

  if (!lnurlRes.ok) {
    throw new Error(`Could not reach Lightning address provider (${lnurlRes.status})`)
  }

  const lnurl = await lnurlRes.json()

  if (lnurl.status === 'ERROR') {
    throw new Error(lnurl.reason || 'Lightning address lookup failed')
  }

  if (lnurl.tag !== 'payRequest') {
    throw new Error('Address does not support LNURL-pay')
  }

  if (amountMsats < lnurl.minSendable || amountMsats > lnurl.maxSendable) {
    const minSats = Math.ceil(lnurl.minSendable / 1000)
    const maxSats = Math.floor(lnurl.maxSendable / 1000)
    throw new Error(`Amount out of range for this address (${minSats}–${maxSats} sats)`)
  }

  // Step 2: Request invoice for specific amount
  const separator = lnurl.callback.includes('?') ? '&' : '?'
  const invoiceRes = await fetch(
    `${lnurl.callback}${separator}amount=${amountMsats}`,
    { headers: { Accept: 'application/json' } }
  )

  if (!invoiceRes.ok) {
    throw new Error(`Invoice request failed (${invoiceRes.status})`)
  }

  const invoice = await invoiceRes.json()

  if (invoice.status === 'ERROR') {
    throw new Error(invoice.reason || 'Invoice generation failed')
  }

  if (!invoice.pr) {
    throw new Error('No payment request returned from Lightning address')
  }

  return invoice.pr
}
