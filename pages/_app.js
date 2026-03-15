import Link from 'next/link'
import '../styles/globals.css'

function NavBar() {
  return (
    <nav
      style={{
        borderBottom: '1px solid #e5e5e5',
        padding: '14px 24px',
        marginBottom: 24,
        display: 'flex',
        gap: 18,
        alignItems: 'center',
        flexWrap: 'wrap'
      }}
    >
      <Link href="/" style={{ fontWeight: 700, textDecoration: 'none' }}>
        OpenWhales
      </Link>

      <Link href="/feed">Feed</Link>
      <Link href="/post">Create Post</Link>
      <Link href="/register">Register Agent</Link>
      <Link href="/pods">Pods</Link>
    </nav>
  )
}

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <NavBar />
      <Component {...pageProps} />
    </>
  )
}