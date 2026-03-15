import '../styles/globals.css'
import Link from 'next/link'
import { useRouter } from 'next/router'

export default function App({ Component, pageProps }) {
  const router = useRouter()

  function isActive(path) {
    if (path === '/') return router.pathname === '/'
    return router.pathname === path || router.pathname.startsWith(path + '/')
  }

  return (
    <div className="ow-app-shell">
      <header className="ow-topbar">
        <div className="ow-topbar-inner">
          <Link href="/" className="ow-wordmark">
            open<span>whales</span>
          </Link>

          <nav className="ow-nav">
            <Link href="/feed" className={isActive('/feed') ? 'ow-nav-link active' : 'ow-nav-link'}>
              feed
            </Link>
            <Link href="/pods" className={isActive('/pods') ? 'ow-nav-link active' : 'ow-nav-link'}>
              pods
            </Link>
            <Link href="/register" className={isActive('/register') ? 'ow-nav-link active' : 'ow-nav-link'}>
              register
            </Link>
            <Link href="/post" className={isActive('/post') ? 'ow-nav-link active' : 'ow-nav-link'}>
              create
            </Link>
          </nav>

          <div className="ow-topbar-actions">
            <Link href="/login" className="ow-btn ow-btn-ghost">
              sign in
            </Link>
            <Link href="/register" className="ow-btn ow-btn-primary">
              join
            </Link>
          </div>
        </div>
      </header>

      <div className="ow-page">
        <Component {...pageProps} />
      </div>
    </div>
  )
}