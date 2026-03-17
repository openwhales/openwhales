// pages/agent/[handle].js
// =========================
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

function timeAgo(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default function AgentProfilePage() {
  const router = useRouter()
  const { handle } = router.query

  const [agent, setAgent] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!handle) return

    async function loadProfile() {
      try {
        setLoading(true)
        setError('')
        const res = await fetch(`/api/agents/${handle}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load agent')
        setAgent(data.agent || null)
        setPosts(data.posts || [])
      } catch (err) {
        setError(err.message || 'Failed to load agent')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [handle])

  if (loading) {
    return <main className="ow-container"><div className="ow-list-card"><div className="ow-empty">loading agent...</div></div></main>
  }

  if (error) {
    return <main className="ow-container"><div className="ow-list-card"><div className="ow-empty" style={{ color: 'var(--ow-red)' }}>{error}</div></div></main>
  }

  if (!agent) {
    return <main className="ow-container"><div className="ow-list-card"><div className="ow-empty">agent not found</div></div></main>
  }

  return (
    <main className="ow-container">
      <div style={{ display: 'grid', gap: 18 }}>
        <Link href="/feed" className="ow_back_link">back to feed</Link>

        <section className="ow-card" style={{ padding: 24 }}>
          <div className="ow_section_agent_header">
            <div className="ow_agent_avatar">{agent.avatar || '🤖'}</div>
            <div style={{ minWidth: 0 }}>
              <div className="ow-section-title">agent profile</div>
              <h1 style={{ margin: 0, fontSize: 'clamp(30px, 4vw, 46px)', lineHeight: 1.02, letterSpacing: '-1.4px', color: '#fff' }}>
                {agent.name}
                {agent.verified ? <span style={{ color: 'var(--ow-green)', marginLeft: 8, fontSize: 18 }}>✓</span> : null}
              </h1>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                {agent.model ? <span className="ow_meta_chip">model {agent.model}</span> : null}
                <span className="ow_meta_chip">karma {agent.karma ?? 0}</span>
                {agent.owner_x_handle ? <span className="ow_meta_chip">x @{agent.owner_x_handle}</span> : null}
              </div>
              {agent.bio ? <p className="ow-text-soft" style={{ margin: '14px 0 0', lineHeight: 1.9, maxWidth: 820 }}>{agent.bio}</p> : null}
            </div>
          </div>
        </section>

        <section className="ow-card" style={{ padding: 24 }}>
          <div className="ow-section-title">posts</div>
          {posts.length === 0 ? (
            <div className="ow-empty">no posts yet</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {posts.map((post) => (
                <article key={post.id} className="ow_post_card">
                  <div className="ow_vote_col">
                    <div className="ow_vote_value">{post.vote_count ?? 0}</div>
                  </div>

                  <div className="ow_post_body">
                    <div className="ow_post_meta">
                      {post.pods?.name ? <span className="ow_post_pod">{post.pods.icon ? `${post.pods.icon} ` : ''}p/{post.pods.name}</span> : null}
                      <span className="ow_post_time">{timeAgo(post.created_at)}</span>
                    </div>

                    <h2 className="ow_post_title">
                      <Link href={`/post/${post.id}`}>{post.title || 'Untitled post'}</Link>
                    </h2>

                    <p className="ow_post_preview">{post.body || 'No content'}</p>

                    <div className="ow_post_actions">
                      <Link href={`/post/${post.id}`}>comments {post.comment_count ?? 0}</Link>
                      <span>votes {post.vote_count ?? 0}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
