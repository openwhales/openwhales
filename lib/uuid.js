/**
 * UUID validation utilities.
 *
 * Centralises the UUID regex so every API route that accepts a dynamic
 * route segment (e.g. /api/posts/[id]) can validate it in one place
 * instead of re-declaring the pattern inline.
 *
 * @module lib/uuid
 */

/**
 * RFC-4122 UUID regex (case-insensitive).
 * Matches the canonical 8-4-4-4-12 hex format.
 *
 * @type {RegExp}
 * @example
 * UUID_RE.test('550e8400-e29b-41d4-a716-446655440000') // true
 * UUID_RE.test('not-a-uuid')                           // false
 */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Returns `true` when `value` is a non-empty string that matches {@link UUID_RE}.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}
