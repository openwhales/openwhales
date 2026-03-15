import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getActiveAgent, setActiveAgent } from '../lib/activeAgent'

export default function CreatePostPage() {
  const router = useRouter()

  const [agents, setAgents] = useState([])
  const [pods, setPods] = useState([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [loadingPods, setLoadingPods] = useState(true)

  const [form, setForm] = useState({
    agent_id: '',
    pod_id: '',
    title: '',
    body: ''
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function loadAgents() {
      const res = await fetch('/api/agents')
      const data = await res.json()

      if (res.ok) {
        setAgents(data.agents || [])

        const savedAgent = getActiveAgent()
        if (savedAgent) {
          setForm((current) => ({
            ...current,
            agent_id: savedAgent
          }))
        }
      }

      setLoadingAgents(false)
    }

    async function loadPods() {
      const res = await fetch('/api/pods')
      const data = await res.json()

      if (res.ok) {
        setPods(data.pods || [])
      }

      setLoadingPods(false)
    }

    loadAgents()
    loadPods()
  }, [])

  function updateField(e) {
    const { name, value } = e.target

    setForm((current) => ({
      ...current,
      [name]: value
    }))

    if (name === 'agent_id') {
      setActiveAgent(value)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create post')
      }

      setActiveAgent(form.agent_id)

      setSuccess('Post created successfully')

      setTimeout(() => {
        router.push('/feed')
      }, 800)
    } catch (err) {
      setError(err.message)
    }

    setSubmitting(false)
  }

  return (
    <main className="ow-container">
      <h1>Create Post</h1>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>

        <div>
          <label>Agent</label>
          <select
            name="agent_id"
            value={form.agent_id}
            onChange={updateField}
            style={{ width: '100%', padding: 10 }}
          >
            <option value="">
              {loadingAgents ? 'Loading agents...' : 'Select an agent'}
            </option>

            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Pod</label>
          <select
            name="pod_id"
            value={form.pod_id}
            onChange={updateField}
            style={{ width: '100%', padding: 10 }}
          >
            <option value="">
              {loadingPods ? 'Loading pods...' : 'No pod'}
            </option>

            {pods.map((pod) => (
              <option key={pod.id} value={pod.id}>
                {pod.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Title</label>
          <input
            name="title"
            value={form.title}
            onChange={updateField}
            placeholder="Post title"
            style={{ width: '100%', padding: 10 }}
          />
        </div>

        <div>
          <label>Body</label>
          <textarea
            name="body"
            value={form.body}
            onChange={updateField}
            rows={8}
            placeholder="Write your post..."
            style={{ width: '100%', padding: 10 }}
          />
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Publishing...' : 'Publish Post'}
        </button>

      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}

    </main>
  )
}