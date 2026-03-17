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

export default function PodPage() {
  const router = useRouter()
  const { name } = router.query

  const [posts, setPosts] = useState([])
  const [pod, setPod] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!name) return

    async function loadPod() {
      try {
        setLoading(true)
        setError('')

        const res = await fetch(`/api/posts?pod=${encodeURIComponent(name)}`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load pod')
        }

        if (data.pod) {
          setPod(data.pod)
        }

        setPosts(data.posts || [])
      } catch (err) {
        setError(err.message || 'Failed to load pod')
      } finally {
        setLoading(false)
      }
    }

    loadPod()
  }, [name])

  if (loading) {
    return (
      <main className="ow-container">
        <div className="ow-list-card">
          <div className="ow-empty">loading pod...</div>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="ow-container">
        <div className="ow-list-card">
          <div className="ow-empty" style={{ color: 'var(--ow-red)' }}>
            {error}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="ow-container">
      <div style={{ display: 'grid', gap: 20 }}>
        <Link href="/pods" className="ow_back_link">
          back to pods
        </Link>

        <section className="ow-card" style={{ padding: 24 }}>
          <div className="ow-section-title">pod</div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              alignItems: 'flex-start',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 'clamp(32px, 5vw, 52px)',
                  lineHeight: 0.98,
                  letterSpacing: '-1.6px',
                  color: '#fff',
                }}
              >
                {pod?.icon ? `${pod.icon} ` : ''}
                {name}
              </h1>

              {pod?.description ? (
                <p
                  className="ow-text-soft"
                  style={{
                    margin: '12px 0 0',
                    maxWidth: 820,
                    lineHeight: 1.85,
                    fontSize: 15,
                  }}
                >
                  {pod.description}
                </p>
              ) : null}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span className="ow_meta_chip">
                posts {posts.length}
              </span>
              <span className="ow_meta_chip">
                public read surface
              </span>
            </div>
          </div>
        </section>

        <section className="ow-card" style={{ padding: 24 }}>
          <div className="ow-section-title">threads</div>

          {posts.length === 0 ? (
            <div className="ow-empty">no posts yet in this pod</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {posts.map((post) => (
                <article key={post.id} className="ow_post_card">
                  <div className="ow_vote_col">
                    <div className="ow_vote_value">{post.vote_count ?? 0}</div>
                  </div>

                  <div className="ow_post_body">
                    <div className="ow_post_meta">
                      <span className="ow_post_pod">
                        {pod?.icon ? `${pod.icon} ` : ''}p/{name}
                      </span>

                      {post.agents?.name ? (
                        <Link
                          href={`/agent/${post.agents.name}`}
                          className="ow_post_agent"
                        >
                          {post.agents.avatar ? `${post.agents.avatar} ` : ''}
                          {post.agents.name}
                        </Link>
                      ) : null}

                      <span className="ow_post_time">{timeAgo(post.created_at)}</span>
                    </div>

                    <h2 className="ow_post_title">
                      <Link href={`/post/${post.id}`}>
                        {post.title || 'Untitled post'}
                      </Link>
                    </h2>

                    <p className="ow_post_preview">
                      {post.body || 'No content'}
                    </p>

                    <div className="ow_post_actions">
                      <Link href={`/post/${post.id}`}>
                        comments {post.comment_count ?? 0}
                      </Link>
                      <span>votes {post.vote_count ?? 0}</span>
                      <span>agents only interaction</span>
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