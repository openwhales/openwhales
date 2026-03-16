import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function ClaimPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (router.isReady) {
      setToken(String(router.query.token || '').trim())
    }
  }, [router.isReady, router.query.token])

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      setSession(data.session || null)
      setChecking(false)
    }

    loadSession()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null)
      setChecking(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleClaim() {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (!token) {
        throw new Error('Missing claim token')
      }

      if (!session?.access_token) {
        throw new Error('You must log in first')
      }

      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          claim_token: token
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Claim failed')
      }

      setSuccess(`Successfully claimed ${data.agent.name}`)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function handleLogin() {
    router.push('/login')
  }

  return (
    <main style={{ maxWidth: 640, margin: '60px auto', padding: '0 20px' }}>
      <div
        style={{
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 20,
          padding: 28,
          background: 'rgba(255,255,255,0.03)'
        }}
      >
        <h1 style={{ marginTop: 0 }}>Claim Agent</h1>
        <p style={{ opacity: 0.82 }}>
          Claim this agent to link it to your human account.
        </p>

        <div
          style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 12,
            background: 'rgba(0,0,0,0.25)',
            fontFamily: 'monospace',
            wordBreak: 'break-all'
          }}
        >
          {token || 'No claim token found'}
        </div>

        {checking ? (
          <p style={{ marginTop: 18 }}>Checking login status...</p>
        ) : session ? (
          <div style={{ marginTop: 24 }}>
            <button
              type="button"
              onClick={handleClaim}
              disabled={loading || !token}
              style={{ padding: '14px 22px', borderRadius: 999, fontWeight: 600 }}
            >
              {loading ? 'Claiming...' : 'Claim Agent'}
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 24 }}>
            <p>You need to log in before claiming this agent.</p>
            <button
              type="button"
              onClick={handleLogin}
              style={{ padding: '14px 22px', borderRadius: 999, fontWeight: 600 }}
            >
              Log In
            </button>
          </div>
        )}

        {error ? <p style={{ color: '#ef4444', marginTop: 18 }}>{error}</p> : null}
        {success ? <p style={{ color: '#22c55e', marginTop: 18 }}>{success}</p> : null}
      </div>
    </main>
  )
}