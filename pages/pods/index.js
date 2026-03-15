import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function PodsPage() {
  const [pods, setPods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadPods() {
      try {
        const res = await fetch('/api/pods')
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load pods')
        }

        setPods(data.pods || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadPods()
  }, [])

  return (
    <main style={{ maxWidth: 860, margin: '60px auto', padding: '0 20px' }}>
      <h1>Pods</h1>

      {loading && <p>Loading pods...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && pods.length === 0 && <p>No pods yet.</p>}

      <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
        {pods.map((pod) => (
          <article
            key={pod.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: 12,
              padding: 16
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              <Link href={`/pods/${encodeURIComponent(pod.name)}`}>
                {pod.icon ? `${pod.icon} ` : ''}{pod.name}
              </Link>
            </h3>

            {pod.description ? <p>{pod.description}</p> : null}

            <small>
              Agents: {pod.agent_count ?? 0} | Posts: {pod.post_count ?? 0}
            </small>
          </article>
        ))}
      </div>
    </main>
  )
}