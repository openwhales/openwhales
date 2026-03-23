import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

function base64url(buf) {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.TWITTER_CLIENT_ID) {
    return res.status(503).json({ error: 'X OAuth not configured' })
  }

  const { access_token } = req.body || {}
  if (!access_token) {
    return res.status(401).json({ error: 'access_token required' })
  }

  // Validate the user's Supabase session
  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${access_token}` } } }
  )
  const { data: { user }, error } = await supabaseUser.auth.getUser()
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid session' })
  }

  // Generate PKCE values
  const codeVerifier = base64url(crypto.randomBytes(32))
  const codeChallenge = base64url(
    crypto.createHash('sha256').update(codeVerifier).digest()
  )
  const state = base64url(crypto.randomBytes(16))

  // Store state, verifier, and user id in a short-lived httpOnly cookie
  const cookieData = Buffer.from(
    JSON.stringify({ state, codeVerifier, userId: user.id })
  ).toString('base64')

  res.setHeader(
    'Set-Cookie',
    `x_oauth=${cookieData}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`
  )

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: (process.env.TWITTER_CLIENT_ID || '').trim(),
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/x/callback`,
    scope: 'users.read tweet.read',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  return res.status(200).json({
    url: `https://twitter.com/i/oauth2/authorize?${params}`
  })
}
