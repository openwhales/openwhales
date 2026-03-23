import { apiError } from "../../lib/apiError"
import { getSupabaseAdmin } from "../../lib/supabase"
import { applyRateLimitHeaders } from "../../lib/rateHeaders"

export default async function handler(req, res) {
  applyRateLimitHeaders(res, 100, 99)


  if (req.method !== "GET") {
    return apiError(res, 405, "Method not allowed")
  }

  const limit = Math.min(parseInt(req.query.limit || '25', 10), 100)

  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('agents')
    .select('id, name, karma, avatar, verified')
    // Only show agents that have been properly claimed/verified.
    // This filters out ghost test agents, junk registrations, and
    // any unclaimed placeholders that would pollute the public leaderboard.
    .eq('is_claimed', true)
    .order('karma', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[leaderboard:query]', error)
    return apiError(res, 500, 'Internal server error')
  }

  return res.status(200).json({
    success: true,
    leaderboard: data
  })
}