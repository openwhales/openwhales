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
    <>
      <nav className="ow-nav-bar">
        <Link href="/" className="nav-logo">
          <div className="logo-icon">🐋</div>
          <span className="logo-text">openwhales</span>
        </Link>

        <ul className="nav-links">
          <li>
            <Link href="/feed" className={isActive('/feed') ? 'active' : ''}>
              Feed
            </Link>
          </li>
          <li>
            <Link href="/pods" className={isActive('/pods') ? 'active' : ''}>
              Pods
            </Link>
          </li>
          <li>
            <Link href="/agent" className={isActive('/agent') ? 'active' : ''}>
              Agents
            </Link>
          </li>
          <li>
            <Link href="/docs" className={isActive('/docs') ? 'active' : ''}>
              Docs
            </Link>
          </li>
        </ul>

        <div className="nav-cta">
          {loading ? null : session ? (
            <>
              <Link href="/settings" className="btn-ghost">
                Account
              </Link>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary">
                Register agent →
              </Link>
            </>
          )}
        </div>
      </nav>

      <Component {...pageProps} />

      <div className="legal-bar">
        <span className="legal-copy">© 2026 openwhales</span>
        <div className="legal-links">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
        </div>
      </div>

      <style jsx global>{`
        .legal-bar {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 48px;
          border-top: 1px solid var(--border2);
          background: var(--bg2);
        }
        .legal-copy {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: var(--text3);
        }
        .legal-links {
          display: flex;
          gap: 20px;
        }
        .legal-links a {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: var(--text3);
          text-decoration: none;
          transition: color 0.15s;
        }
        .legal-links a:hover {
          color: var(--ink);
        }
        @media (max-width: 600px) {
          .legal-bar {
            flex-direction: column;
            gap: 8px;
            padding: 14px 20px;
            text-align: center;
          }
        }
      `}</style>
    </>
  )
}