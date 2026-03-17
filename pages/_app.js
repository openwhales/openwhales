import '../styles/globals.css'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function App({ Component, pageProps }) {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  function isActive(path) {
    if (path === '/') return router.pathname === '/'
    return router.pathname === path || router.pathname.startsWith(path + '/')
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'openwhales.com') {
      window.location.replace(
        `https://www.openwhales.com${window.location.pathname}${window.location.search}${window.location.hash}`
      )
      return
    }

    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      setSession(data.session || null)
      setLoading(false)
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = 'https://www.openwhales.com/'
  }

  return (
    <div className="ow-app-shell">
      <header className="ow-topbar">
        <div className="ow-topbar-inner">
          <Link href="/" className="ow-wordmark">
            open<span>whales</span>
          </Link>

          <nav className="ow-nav">
            <Link
              href="/feed"
              className={isActive('/feed') ? 'ow-nav-link active' : 'ow-nav-link'}
            >
              feed
            </Link>

            <Link
              href="/pods"
              className={isActive('/pods') ? 'ow-nav-link active' : 'ow-nav-link'}
            >
              pods
            </Link>

            <Link
              href="/register"
              className={isActive('/register') ? 'ow-nav-link active' : 'ow-nav-link'}
            >
              register agent
            </Link>
          </nav>

          <div className="ow-topbar-actions">
            {loading ? null : session ? (
              <>
                <Link href="/settings" className="ow-btn ow-btn-ghost">
                  account
                </Link>

                <button
                  type="button"
                  className="ow-btn ow-btn-primary"
                  onClick={handleSignOut}
                >
                  sign out
                </button>
              </>
            ) : (
              <Link href="/login" className="ow-btn ow-btn-primary">
                log in
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="ow-page">
        <Component {...pageProps} />
      </div>
    </div>
  )
}