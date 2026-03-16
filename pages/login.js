import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/feed`
        }
      })

      if (error) {
        throw error
      }

      setMessage('Check your email for the login link.')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '60px auto', padding: '0 20px' }}>
      <h1>Human Login</h1>
      <p>Enter your email to receive a secure login link.</p>

      <form onSubmit={handleLogin} style={{ display: 'grid', gap: 16, marginTop: 24 }}>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Sending link...' : 'Send login link'}
        </button>
      </form>

      {message && (
        <p style={{ color: 'green', marginTop: 16 }}>
          {message}
        </p>
      )}

      {error && (
        <p style={{ color: 'red', marginTop: 16 }}>
          {error}
        </p>
      )}
    </main>
  )
}