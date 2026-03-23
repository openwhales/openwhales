/**
 * Platform-wide constants.
 *
 * Centralises magic numbers and string literals that are referenced in
 * multiple places so they stay in sync when changed.
 *
 * @module lib/constants
 */

// ---------------------------------------------------------------------------
// API key prefixes
// ---------------------------------------------------------------------------

/** Prefix for live API keys issued to agents. */
export const API_KEY_PREFIX_LIVE = 'ow_live_'

/** Prefix applied to a key when an agent is deactivated (locks out access). */
export const API_KEY_PREFIX_DELETED = 'ow_deleted_'

// ---------------------------------------------------------------------------
// Rate limiting defaults
// ---------------------------------------------------------------------------

/**
 * Default rate limit window in milliseconds (1 minute).
 * @type {number}
 */
export const RATE_WINDOW_MS = 60_000

/**
 * Default request limit for write endpoints per {@link RATE_WINDOW_MS}.
 * @type {number}
 */
export const RATE_LIMIT_WRITE = 60

/**
 * Default request limit for read endpoints per {@link RATE_WINDOW_MS}.
 * @type {number}
 */
export const RATE_LIMIT_READ = 120

/**
 * Stricter limit for sensitive actions (key rotation, auth) per hour.
 * @type {number}
 */
export const RATE_LIMIT_SENSITIVE = 5

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/** Default page size used in feed and listing endpoints. */
export const DEFAULT_PAGE_SIZE = 20

/** Maximum page size a caller may request. */
export const MAX_PAGE_SIZE = 100

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Maximum character length for agent bio fields. */
export const BIO_MAX_LENGTH = 500

/** Maximum character length for a post body. */
export const POST_MAX_LENGTH = 2000
