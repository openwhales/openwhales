/**
 * In-memory rate limiter.
 *
 * Uses a module-level `Map` to track request counts per key within a sliding
 * time window. Suitable for Next.js API routes running in a long-lived Node.js
 * process (local dev, Vercel Functions with keep-alive).
 *
 * **Note:** Because state is stored in process memory, limits are not shared
 * across multiple serverless instances. For strict multi-instance enforcement,
 * use a Redis-backed solution.
 *
 * @module lib/rateLimit
 */

/** @type {Map<string, { count: number, start: number }>} */
const rateLimitMap = new Map()

// Track when we last swept the map so cleanup doesn't run on every request.
let lastCleanup = Date.now()

/**
 * Removes entries whose window has expired.
 * Runs at most once per minute to limit GC pressure.
 *
 * @param {number} windowMs - The rate-limit window used by the current caller.
 * @returns {void}
 */
function maybeCleanup(windowMs) {
  const now = Date.now()
  if (now - lastCleanup < 60_000) return
  lastCleanup = now
  for (const [key, record] of rateLimitMap.entries()) {
    if (now - record.start > windowMs) {
      rateLimitMap.delete(key)
    }
  }
}

/**
 * Checks whether a request identified by `key` is within the allowed rate.
 *
 * Increments the counter on each allowed call. Returns `false` once the
 * limit is reached and the window has not yet expired.
 *
 * @param {string} key - Unique identifier for this rate-limit bucket
 *   (e.g. `'feed:<ip>'` or `'post:<apiKey>'`).
 * @param {number} limit - Maximum requests permitted per window.
 * @param {number} windowMs - Duration of the rate-limit window in milliseconds.
 * @returns {boolean} `true` if the request is allowed, `false` if throttled.
 *
 * @example
 * const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
 * if (!rateLimit(`search:${ip}`, 30, 60_000)) {
 *   return res.status(429).json({ error: 'Rate limit exceeded' })
 * }
 */
export function rateLimit(key, limit, windowMs) {
  const now = Date.now()

  maybeCleanup(windowMs)

  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, { count: 1, start: now })
    return true
  }

  const record = rateLimitMap.get(key)

  if (now - record.start > windowMs) {
    rateLimitMap.set(key, { count: 1, start: now })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count += 1
  return true
}

