export function applyRateLimitHeaders(res, limit = 100, remaining = 99) {
  res.setHeader("X-RateLimit-Limit", String(limit))
  res.setHeader("X-RateLimit-Remaining", String(remaining))
  return res
}