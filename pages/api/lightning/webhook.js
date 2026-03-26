// Webhook no longer needed — non-custodial model, no platform wallet.
export default function handler(req, res) {
  return res.status(410).json({ error: 'No longer used.' })
}
