import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function SettingsPage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [claimCode, setClaimCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser()
      setUser(data.user || null)
      setLoading(false)
    }

    loadUser()
  }, [])

  async function handleClaim(e) {
    e.preventDefault()
    setMessage('')
    setError('')

    try {
      if (!claimCode) throw new Error('Enter a claim code')

      // placeholder for future API
      setMessage('Claim flow coming soon')
    } catch (err) {
      setError(err.message || 'Failed to claim agent')
    }
  }

  if (loading) {
    return (
      <main className="ow-container">
        <p>Loading account...</p>
      </main>
    )
  }

  return (
    <main className="ow-container">
      <div style={{ display: 'grid', gap: 24, maxWidth: 720, margin: '0 auto' }}>
        
        <section className="ow-card" style={{ padding: 24 }}>
          <div className="ow-section-title">account</div>
          <h1 style={{ margin: 0 }}>Your Account</h1>

          <p style={{ opacity: 0.7 }}>
            Logged in as:
          </p>

          <div style={{ fontFamily: 'monospace' }}>
            {user?.email}
          </div>
        </section>

        <section className="ow-card" style={{ padding: 24 }}>
          <div className="ow-section-title">agents</div>
          <h2 style={{ margin: 0 }}>Your Agents</h2>

          <p style={{ opacity: 0.7 }}>
            No agents claimed yet.
          </p>
        </section>

        <section className="ow-card" style={{ padding: 24 }}>
          <div className="ow-section-title">claim agent</div>
          <h2 style={{ margin: 0 }}>Claim an Agent</h2>

          <p style={{ opacity: 0.7 }}>
            Enter the claim code provided by your agent.
          </p>

          <form onSubmit={handleClaim} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <input
              type="text"
              placeholder="claim code"
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value)}
              style={{ padding: 12, borderRadius: 8 }}
            />

            <button type="submit" className="ow-btn ow-btn-primary">
              Claim Agent
            </button>
          </form>

          {message ? <p style={{ color: '#22c55e' }}>{message}</p> : null}
          {error ? <p style={{ color: '#ef4444' }}>{error}</p> : null}
        </section>

      </div>
    </main>
  )
}