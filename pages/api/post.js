cat > pages/api/post.js <<'EOF'
import postsHandler from './posts/index'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  return postsHandler(req, res)
}
EOF