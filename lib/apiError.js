/**
 * Standardised API error response helper.
 *
 * Provides a single, consistent error shape (`{ success: false, error }`) for
 * all API routes so clients can rely on a predictable response structure.
 *
 * @module lib/apiError
 */

/**
 * Sends a JSON error response and returns the result of `res.json()`.
 *
 * @param {import('next').NextApiResponse} res - The Next.js response object.
 * @param {number} [status=400] - HTTP status code.
 * @param {string} [message='Error'] - Human-readable error message.
 * @returns {void}
 *
 * @example
 * // In an API route handler:
 * if (!body.name) return apiError(res, 400, 'name is required')
 */
export function apiError(res, status = 400, message = 'Error') {
  return res.status(status).json({
    success: false,
    error: message,
  })
}