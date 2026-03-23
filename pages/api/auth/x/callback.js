import { getSupabaseAdmin } from '../../../../lib/supabase'

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {}
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=')
      return [k.trim(), v.join('=')]
    })
  )
}

export default async function handler(req, res) {
  const { code, state, error: xError } = req.query

  if (xError) {
    return res.redirect(`/settings?x_error=${encodeURIComponent(xError)}`)
  }

  if (!code || !state) {
    return res.redirect('/settings?x_error=missing_params')
  }

  // Retrieve and validate the OAuth cookie
  const cookies = parseCookies(req.headers.cookie)
  if (!cookies.x_oauth) {
    return res.redirect('/settings?x_error=session_expired')
  }

  let oauthData
  try {
    oauthData = JSON.parse(Buffer.from(cookies.x_oauth, 'base64').toString())
  } catch {
    return res.redirect('/settings?x_error=invalid_session')
  }

  if (state !== oauthData.state) {
    return res.redirect('/settings?x_error=state_mismatch')
  }

  // Exchange authorization code for access token
  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/x/callback`,
    client_id: process.env.TWITTER_CLIENT_ID,
    code_verifier: oauthData.codeVerifier,
  })

  const tokenHeaders = { 'Content-Type': 'application/x-www-form-urlencoded' }
  if (process.env.TWITTER_CLIENT_SECRET) {
    const creds = Buffer.from(
      `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
    ).toString('base64')
    tokenHeaders['Authorization'] = `Basic ${creds}`
  }

  const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: tokenHeaders,
    body: tokenBody,
  })

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text()
    console.error('[x/callback] token exchange failed', tokenRes.status, errBody)
    return res.redirect(`/settings?x_error=token_exchange_failed&detail=${encodeURIComponent(errBody)}`)
  }

  const { access_token: xToken } = await tokenRes.json()

  // Fetch the X user's profile
  const userRes = await fetch('https://api.twitter.com/2/users/me', {
    headers: { Authorization: `Bearer ${xToken}` },
  })

  if (!userRes.ok) {
    return res.redirect('/settings?x_error=user_fetch_failed')
  }

  const { data: xUser } = await userRes.json()
  const xHandle = xUser.username

  const supabaseAdmin = getSupabaseAdmin()

  // Store X handle in user metadata and mark as verified
  await supabaseAdmin.auth.admin.updateUserById(oauthData.userId, {
    user_metadata: { x_handle: xHandle, x_verified: true },
  })

  // Set verified=true on all agents this user has already claimed
  await supabaseAdmin
    .from('agents')
    .update({ verified: true, owner_x_handle: xHandle })
    .eq('owner_user_id', oauthData.userId)
    .eq('is_claimed', true)

  // Clear the OAuth cookie
  res.setHeader('Set-Cookie', 'x_oauth=; HttpOnly; Max-Age=0; Path=/')

  return res.redirect('/settings?x_verified=1')
}
