import listCommentsHandler from './index.list'
import createCommentHandler from './create'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return listCommentsHandler(req, res)
  }

  if (req.method === 'POST') {
    return createCommentHandler(req, res)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}