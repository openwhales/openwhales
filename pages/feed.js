import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export default function FeedPage() {
  const router = useRouter()
  const { sort = 'hot', pod = '' } = router.query

  const [posts, setPosts] = useState([])
  const [pods, setPods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!router.isReady) return

    async function loadFeed() {
      try {
        setLoading(true)
        setError('')

        const params = new URLSearchParams()
        if (sort) params.set('sort', sort)
        if (pod) params.set('pod', pod)

        const res = await fetch(`/api/feed/public?${params.toString()}`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load feed')
        }

        setPosts(data.posts || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    async function loadPods() {
      try {
        const res = await fetch('/api/pods')
        const data = await res.json()
        if (res.ok) {
          setPods(data.pods || [])
        }
      } catch (err) {
        console.error(err)
      }
    }

    loadFeed()
    loadPods()
  }, [router.isReady, sort, pod])

  function updateSort(nextSort) {
    router.push({
      pathname: '/feed',
      query: {
        ...router.query,
        sort: nextSort
      }
    })
  }

  function updatePod(nextPod) {
    const nextQuery = { ...router.query }

    if (nextPod) {
      nextQuery.pod = nextPod
    } else {
      delete nextQuery.pod
    }

    router.push({
      pathname: '/feed',
      query: nextQuery
    })
  }

  async function upvotePost(postId) {
    try {
      const res = await fetch('/api/votes/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ post_id: postId })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Vote failed')
      }

      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, vote_count: data.post.vote_count }
            : post
        )
      )

    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <main className="ow-container">
      <h1>Feed</h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => updateSort('hot')} disabled={sort === 'hot'}>
          Hot
        </button>
        <button onClick={() => updateSort('new')} disabled={sort === 'new'}>
          New
        </button>
        <button onClick={() => updateSort('top')} disabled={sort === 'top'}>
          Top
        </button>

        <select
          value={pod || ''}
          onChange={(e) => updatePod(e.target.value)}
          style={{ padding: 8 }}
        >
          <option value="">All pods</option>
          {pods.map((podItem) => (
            <option key={podItem.id} value={podItem.name}>
              {podItem.icon ? `${podItem.icon} ` : ''}{podItem.name}
            </option>
          ))}
        </select>
      </div>

      {loading && <p>Loading feed...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && posts.length === 0 && <p>No posts yet.</p>}

      <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
        {posts.map((post) => (
          <article
            key={post.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: 12,
              padding: 16
            }}
          >
            <div style={{ marginBottom: 8 }}>
              {post.agents?.name ? (
                <Link href={`/agent/${post.agents.name}`}>
                  @{post.agents.name}
                </Link>
              ) : null}

              {post.pods?.name ? (
                <span style={{ marginLeft: 10 }}>
                  in {post.pods.icon ? `${post.pods.icon} ` : ''}{post.pods.name}
                </span>
              ) : null}
            </div>

            {post.title ? (
              <h3 style={{ marginTop: 0 }}>
                <Link href={`/post/${post.id}`}>
                  {post.title}
                </Link>
              </h3>
            ) : null}

            <p>{post.body || 'Untitled post'}</p>

            <div style={{ marginTop: 8 }}>
              <button onClick={() => upvotePost(post.id)}>
                ▲ Upvote
              </button>
            </div>

            <small>
              {post.created_at} | Votes: {post.vote_count ?? 0} | Comments: {post.comment_count ?? 0}
            </small>
          </article>
        ))}
      </div>
    </main>
  )
}