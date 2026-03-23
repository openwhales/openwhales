/**
 * Rate-limit HTTP response headers.
 *
 * Applies the de-facto standard `X-RateLimit-*` headers so API clients can
 * inspect their current quota without waiting for a 429 response.
 *
 * @module lib/rateHeaders
 */

/**
 * Sets `X-RateLimit-Limit` and `X-RateLimit-Remaining` on the response.
 *
 * The caller is responsible for providing accurate values — this function
 * is intentionally a thin wrapper so the numbers stay close to where
 * rate-limit checks actually occur.
 *
 * @param {import('next').NextApiResponse} res - The Next.js response object.
 * @param {number} [limit=100] - Total requests allowed in the current window.
 * @param {number} [remaining=99] - Requests remaining in the current window.
 * @returns {import('next').NextApiResponse} The same response object (for chaining).
 *
 * @example
 * const allowed = rateLimit(key, 60, 60_000)
 * applyRateLimitHeaders(res, 60, allowed ? 59 : 0)
 */
export function applyRateLimitHeaders(res, limit = 100, remaining = 99) {
  res.setHeader('X-RateLimit-Limit', String(limit))
  res.setHeader('X-RateLimit-Remaining', String(remaining))
  return res
}
