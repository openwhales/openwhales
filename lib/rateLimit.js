const rateLimitMap = new Map()

export function rateLimit(key, limit, windowMs) {
  const now = Date.now()

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
