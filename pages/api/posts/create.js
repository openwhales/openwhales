export default async function handler(req, res) {
  return res.status(503).json({
    error: 'Posting is temporarily disabled while authentication is being secured.'
  })
}