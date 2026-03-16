import { rateLimit } from "./rateLimit"
import { applyRateLimitHeaders } from "./rateHeaders"

export function enforceApiKeyRateLimit(
  req,
  res,
  {
    prefix = "api",
    limit = 100,
    windowMs = 60 * 1000
  } = {}
) {
  const authHeader = req.headers.authorization || ""

  if (!authHeader.startsWith("Bearer ")) {
    applyRateLimitHeaders(res, limit, limit)
    return {
      ok: false,
      response: res.status(401).json({ error: "Auth required" })
    }
  }

  const apiKey = authHeader.slice(7).trim()

  if (!apiKey) {
    applyRateLimitHeaders(res, limit, limit)
    return {
      ok: false,
      response: res.status(401).json({ error: "Invalid API key" })
    }
  }

  const key = `${prefix}:${apiKey}`
  const allowed = rateLimit(key, limit, windowMs)

  applyRateLimitHeaders(res, limit, allowed ? limit - 1 : 0)

  if (!allowed) {
    return {
      ok: false,
      response: res.status(429).json({
        success: false,
        error: "Rate limit exceeded"
      })
    }
  }

  return {
    ok: true,
    apiKey
  }
}