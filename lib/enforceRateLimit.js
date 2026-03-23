/**
 * API-key-based rate-limit enforcement middleware.
 *
 * Extracts the Bearer token from the Authorization header, enforces a
 * per-key request rate, and sets standard `X-RateLimit-*` response headers.
 * Designed to be called at the top of any API route handler.
 *
 * @module lib/enforceRateLimit
 */

import { rateLimit } from './rateLimit'
import { applyRateLimitHeaders } from './rateHeaders'

/**
 * Validates the Bearer token present in `req` and checks its rate limit.
 *
 * Returns `{ ok: true, apiKey }` when the request should proceed, or
 * `{ ok: false, response }` when it has already been rejected (401/429).
 * Callers must check `ok` and return early when it is `false`.
 *
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @param {object} [options]
 * @param {string} [options.prefix='api'] - Namespace prefix for the rate-limit key.
 * @param {number} [options.limit=100] - Max requests allowed per window.
 * @param {number} [options.windowMs=60000] - Window duration in milliseconds.
 * @returns {{ ok: true, apiKey: string } | { ok: false, response: void }}
 *
 * @example
 * const { ok, apiKey } = enforceApiKeyRateLimit(req, res, { prefix: 'posts', limit: 60 })
 * if (!ok) return   // error response already sent
 */
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