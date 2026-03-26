// Custodial balance endpoint removed — non-custodial model.
export default function handler(req, res) {
  return res.status(410).json({ error: 'Custodial balances removed. Tips go peer-to-peer.' })
}
