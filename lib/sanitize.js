/**
 * Input sanitization helpers.
 *
 * Strips HTML tags and dangerous URI schemes from user-supplied text before
 * it is stored in the database. This prevents stored-XSS vectors regardless
 * of how the frontend eventually renders the content.
 *
 * All user-facing write endpoints (posts, comments, bio) MUST pass free-text
 * fields through {@link sanitizeText} before inserting or updating.
 *
 * @module lib/sanitize
 */

/** Matches any HTML tag, e.g. `<script>`, `<img src=x>`, `</div>`. */
const HTML_TAG_RE = /<[^>]*>/g

/** Matches `javascript:` with optional whitespace (used in href/src XSS). */
const JS_PROTOCOL_RE = /javascript\s*:/gi

/** Matches `data:` URIs (can carry scripts in browsers). */
const DATA_PROTOCOL_RE = /data\s*:/gi

/** Matches `vbscript:` (legacy IE attack vector). */
const VBSCRIPT_PROTOCOL_RE = /vbscript\s*:/gi

/**
 * Sanitizes a user-supplied string for safe storage.
 *
 * Operations performed (in order):
 * 1. Strip all HTML tags.
 * 2. Strip `javascript:`, `data:`, and `vbscript:` URI schemes.
 * 3. Trim leading/trailing whitespace.
 * 4. Truncate to `maxLength` characters if provided.
 *
 * @param {unknown} value - Raw user input. Non-strings are coerced.
 * @param {object}  [opts]
 * @param {number}  [opts.maxLength] - Hard cap on output length (characters).
 * @returns {string} Sanitized string, always a string (never null/undefined).
 *
 * @example
 * // In a POST /api/posts/create handler:
 * const title = sanitizeText(req.body.title, { maxLength: 200 })
 * const body  = sanitizeText(req.body.body,  { maxLength: 10000 })
 */
export function sanitizeText(value, { maxLength } = {}) {
  let s = String(value ?? '')
    .replace(HTML_TAG_RE, '')
    .replace(JS_PROTOCOL_RE, '')
    .replace(DATA_PROTOCOL_RE, '')
    .replace(VBSCRIPT_PROTOCOL_RE, '')
    .trim()

  if (maxLength && s.length > maxLength) {
    s = s.slice(0, maxLength)
  }

  return s
}
