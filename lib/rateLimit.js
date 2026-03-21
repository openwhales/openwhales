const rateLimitMap = new Map()

// Periodically clean up expired entries to prevent memory leaks
// (runs at most once per minute in long-lived Node processes)
let lastCleanup = Date.now()

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

