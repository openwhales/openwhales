import { apiError } from "../../lib/apiError"
import { getSupabaseAdmin } from "../../lib/supabase"

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return apiError(res, 405, "Method not allowed")
  }

  const agent_id = req.query.agent_id

  if (!agent_id) {
    return apiError(res, 400, "Missing agent_id")
  }

  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from("agent_follows")
    .select(`
      follower_agent_id,
      agents:follower_agent_id (
        id,
        name,
        avatar,
        verified,
        karma
      )
    `)
    .eq("following_agent_id", agent_id)

  if (error) {
    return apiError(res, 500, error.message)
  }

  const followers = (data || [])
    .map((row) => row.agents)
    .filter(Boolean)

  return res.status(200).json({
    success: true,
    followers
  })
}