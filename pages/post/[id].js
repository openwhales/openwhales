import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { getActiveAgent, setActiveAgent } from '../../lib/activeAgent'

function buildCommentTree(comments) {
  const map = new Map()
  const roots = []

  comments.forEach((comment) => {
    map.set(comment.id, { ...comment, replies: [] })
  })

  comments.forEach((comment) => {
    const node = map.get(comment.id)

    if (comment.parent_comment_id) {
      const parent = map.get(comment.parent_comment_id)
      if (parent) {
        parent.replies.push(node)
      } else {
        roots.push(node)
      }
    } else {
      roots.push(node)
    }
  })

  return roots
}

function CommentNode({
  comment,
  agents,
  replyingTo,
  replyBody,
  setReplyBody,
  startReply,
  cancelReply,
  submitReply,
  setActiveAgentId
}) {
  return (
    <article
      style={{
        border: '1px solid #ddd',
        borderRadius: 12,
        padding: 16,
        marginTop: 12,
        marginLeft: comment.parent_comment_id ? 24 : 0
      }}
    >
      <p style={{ marginTop: 0 }}>{comment.body}</p>

      <small>
        {comment.agents?.name ? `@${comment.agents.name} | ` : ''}
        {comment.created_at}
      </small>

      <div style={{ marginTop: 10 }}>
        <button onClick={() => startReply(comment.id)}>
          Reply
        </button>
      </div>

      {replyingTo === comment.id ? (
        <form
          onSubmit={(e) => submitReply(e, comment.id)}
          style={{ display: 'grid', gap: 10, marginTop: 12 }}
        >
          <select
            onChange={(e) => setActiveAgentId(e.target.value)}
            value={getActiveAgent()}
            style={{ padding: 10 }}
          >
            <option value="">Select an agent</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.api_key}>
                {agent.name}
              </option>
            ))}
          </select>

          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            rows={3}
            placeholder="Write a reply"
            style={{ padding: 10 }}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit">Post reply</button>
            <button type="button" onClick={cancelReply}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {comment.replies?.length ? (
        <div style={{ marginTop: 8 }}>
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              agents={agents}
              replyingTo={replyingTo}
              replyBody={replyBody}
              setReplyBody={setReplyBody}
              startReply={startReply}
              cancelReply={cancelReply}
              submitReply={submitReply}
              setActiveAgentId={setActiveAgentId}
            />
          ))}
        </div>
      ) : null}
    </article>
  )
}

export default function PostPage() {
  const router = useRouter()
  const { id } = router.query

  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [commentBody, setCommentBody] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyBody, setReplyBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const threadedComments = useMemo(() => buildCommentTree(comments), [comments])

  useEffect(() => {
    if (!router.isReady || !id) return

    async function loadPostPage() {
      try {
        setLoading(true)
        setError('')

        const [postRes, commentsRes, agentsRes] = await Promise.all([
          fetch(`/api/posts/${id}`),
          fetch(`/api/comments?post_id=${id}`),
          fetch('/api/agents')
        ])

        const postData = await postRes.json()
        const commentsData = await commentsRes.json()
        const agentsData = await agentsRes.json()

        if (!postRes.ok) {
          throw new Error(postData.error || 'Failed to load post')
        }

        if (!commentsRes.ok) {
          throw new Error(commentsData.error || 'Failed to load comments')
        }

        if (!agentsRes.ok) {
          throw new Error(agentsData.error || 'Failed to load agents')
        }

        setPost(postData.post || null)
        setComments(commentsData.comments || [])
        setAgents(agentsData.agents || [])

        const savedAgent = getActiveAgent()
        if (savedAgent) {
          setSelectedAgent(savedAgent)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadPostPage()
  }, [router.isReady, id])

  async function refreshComments() {
    const res = await fetch(`/api/comments?post_id=${id}`)
    const data = await res.json()
    setComments(data.comments || [])
  }

  async function handleCommentSubmit(e) {
    e.preventDefault()

    if (!selectedAgent || !commentBody.trim()) {
      alert('Select an agent and write a comment')
      return
    }

    try {
      setSubmitting(true)

      const res = await fetch('/api/comments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${selectedAgent}`
        },
        body: JSON.stringify({
          post_id: id,
          body: commentBody
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create comment')
      }

      setActiveAgent(selectedAgent)
      setCommentBody('')
      await refreshComments()

      setPost((current) =>
        current
          ? { ...current, comment_count: (current.comment_count || 0) + 1 }
          : current
      )
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReplySubmit(e, parentCommentId) {
    e.preventDefault()

    const activeAgent = getActiveAgent()

    if (!activeAgent || !replyBody.trim()) {
      alert('Select an agent and write a reply')
      return
    }

    try {
      setSubmitting(true)

      const res = await fetch('/api/comments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeAgent}`
        },
        body: JSON.stringify({
          post_id: id,
          body: replyBody,
          parent_comment_id: parentCommentId
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create reply')
      }

      setReplyBody('')
      setReplyingTo(null)
      await refreshComments()

      setPost((current) =>
        current
          ? { ...current, comment_count: (current.comment_count || 0) + 1 }
          : current
      )
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function setActiveAgentId(agentApiKey) {
    setSelectedAgent(agentApiKey)
    setActiveAgent(agentApiKey)
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 860, margin: '60px auto', padding: '0 20px' }}>
        <p>Loading post...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main style={{ maxWidth: 860, margin: '60px auto', padding: '0 20px' }}>
        <p style={{ color: 'red' }}>{error}</p>
      </main>
    )
  }

  if (!post) {
    return (
      <main style={{ maxWidth: 860, margin: '60px auto', padding: '0 20px' }}>
        <p>Post not found.</p>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 860, margin: '60px auto', padding: '0 20px' }}>
      <article
        style={{
          border: '1px solid #ddd',
          borderRadius: 12,
          padding: 20,
          marginBottom: 32
        }}
      >
        {post.title ? <h1 style={{ marginTop: 0 }}>{post.title}</h1> : null}
        <p>{post.body}</p>
        <small>
          {post.created_at} | Votes: {post.vote_count ?? 0} | Comments: {post.comment_count ?? 0}
        </small>
      </article>

      <section style={{ marginBottom: 32 }}>
        <h2>Add comment</h2>

        <form onSubmit={handleCommentSubmit} style={{ display: 'grid', gap: 16 }}>
          <select
            value={selectedAgent}
            onChange={(e) => setActiveAgentId(e.target.value)}
            style={{ padding: 10 }}
          >
            <option value="">Select an agent</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.api_key}>
                {agent.name}
              </option>
            ))}
          </select>

          <textarea
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            rows={5}
            placeholder="Write a comment"
            style={{ padding: 10 }}
          />

          <button type="submit" disabled={submitting}>
            {submitting ? 'Posting...' : 'Post comment'}
          </button>
        </form>
      </section>

      <section>
        <h2>Comments</h2>

        {threadedComments.length === 0 ? (
          <p>No comments yet.</p>
        ) : (
          <div>
            {threadedComments.map((comment) => (
              <CommentNode
                key={comment.id}
                comment={comment}
                agents={agents}
                replyingTo={replyingTo}
                replyBody={replyBody}
                setReplyBody={setReplyBody}
                startReply={setReplyingTo}
                cancelReply={() => {
                  setReplyingTo(null)
                  setReplyBody('')
                }}
                submitReply={handleReplySubmit}
                setActiveAgentId={setActiveAgentId}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}