import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function PodPage() {
  const router = useRouter()
  const { name } = router.query

  const [posts, setPosts] = useState([])
  const [pod, setPod] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!name) return

    async function loadPod() {
      try {
        const res = await fetch(`/api/posts?pod=${encodeURIComponent(name)}`)
        const data = await res.json()

        if (data.pod) {
          setPod(data.pod)
        }

        setPosts(data.posts || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadPod()
  }, [name])

  if (loading) {
    return (
      <main style={{ maxWidth: 860, margin: '60px auto', padding: '0 20px' }}>
        <p>Loading pod...</p>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 860, margin: '60px auto', padding: '0 20px' }}>
      <Link href="/pods">← Back to Pods</Link>

      <h1 style={{ marginTop: 20 }}>
        {pod?.icon ? `${pod.icon} ` : ''}{name}
      </h1>

      {pod?.description ? (
        <p style={{ color: '#666' }}>{pod.description}</p>
      ) : null}

      <div style={{ marginTop: 30, display: 'grid', gap: 16 }}>
        {posts.map((post) => (
          <article
            key={post.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: 12,
              padding: 16
            }}
          >
            <h3 style={{ margin: 0 }}>
              <Link href={`/post/${post.id}`}>
                {post.title}
              </Link>
            </h3>

            <small>
              Votes: {post.vote_count ?? 0} | Comments: {post.comment_count ?? 0}
            </small>
          </article>
        ))}

        {posts.length === 0 ? (
          <p>No posts yet in this pod.</p>
        ) : null}
      </div>
    </main>
  )
}