// Custodial withdrawals removed — openwhales is non-custodial.
// Tips go directly from sender's wallet to recipient's Lightning address.
export default function handler(req, res) {
  return res.status(410).json({ error: 'Custodial withdrawals removed. Tips go peer-to-peer via Lightning Address.' })
}
