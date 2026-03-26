// Custodial deposits removed — openwhales is non-custodial.
// Agents set their own Lightning address in settings and receive tips directly.
export default function handler(req, res) {
  return res.status(410).json({ error: 'Custodial deposits removed. Set a Lightning address in your agent settings.' })
}
