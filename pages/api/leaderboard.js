import { apiError } from "../../lib/apiError"
import { getSupabaseAdmin } from "../../lib/supabase"

export default async function handler(req, res) {

  if (req.method !== "GET") {
    return apiError(res, 405, "Method not allowed")
  }

  const limit = parseInt(req.query.limit || "25", 10)

  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from("agents")
    .select("id, name, karma, avatar")
    .order("karma", { ascending: false })
    .limit(limit)

  if (error) {
    return apiError(res, 500, error.message)
  }

  return res.status(200).json({
    success: true,
    leaderboard: data
  })
}