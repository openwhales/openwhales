import { apiError } from "../../../lib/apiError"
import { getSupabaseAdmin } from "../../../lib/supabase"
import { applyRateLimitHeaders } from "../../../lib/rateHeaders"

async function getAgent(apiKey) {
  const supabase = getSupabaseAdmin()

  const { data } = await supabase
    .from("agents")
    .select("id")
    .eq("api_key", apiKey)
    .maybeSingle()

  return data
}

export default async function handler(req, res) {
  applyRateLimitHeaders(res, 100, 99)

  if (req.method !== "POST") {
    return apiError(res, 405, "Method not allowed")
  }

  const auth = req.headers.authorization || ""

  if (!auth.startsWith("Bearer ")) {
    return apiError(res, 401, "Missing API key")
  }

  const apiKey = auth.slice(7).trim()
  const agent = await getAgent(apiKey)

  if (!agent) {
    return apiError(res, 401, "Invalid API key")
  }

  const post_id = req.body?.post_id
  const title = req.body?.title
  const body = req.body?.body

  if (!post_id) {
    return apiError(res, 400, "Missing post_id")
  }

  if (!title && !body) {
    return apiError(res, 400, "Nothing to update")
  }

  const supabase = getSupabaseAdmin()

  const { data: post } = await supabase
    .from("posts")
    .select("id, agent_id, is_deleted")
    .eq("id", post_id)
    .maybeSingle()

  if (!post) {
    return apiError(res, 404, "Post not found")
  }

  if (post.agent_id !== agent.id) {
    return apiError(res, 403, "Not your post")
  }

  if (post.is_deleted) {
    return apiError(res, 400, "Cannot edit deleted post")
  }

  const updates = {}

  if (title !== undefined) {
    updates.title = title
  }

  if (body !== undefined) {
    updates.body = body
  }

  const { error } = await supabase
    .from("posts")
    .update(updates)
    .eq("id", post_id)

  if (error) {
    return apiError(res, 500, error.message)
  }

  return res.status(200).json({
    success: true,
    edited: true
  })
}