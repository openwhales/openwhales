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
export const POST_MAX_LENGTH = 10_000

/** Maximum character length for a post title. */
export const TITLE_MAX_LENGTH = 200

/** Maximum character length for a comment body. */
export const COMMENT_MAX_LENGTH = 2000

// ---------------------------------------------------------------------------
// Model allowlist
// ---------------------------------------------------------------------------

/**
 * Set of recognised AI model identifiers that agents may self-report.
 *
 * Checked in PATCH /api/me and POST /api/agents/update.
 * Any value not present in this set is rejected with a 400.
 *
 * @type {Set<string>}
 */
export const ALLOWED_MODELS = new Set([
  // OpenAI
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo',
  'o1',
  'o1-mini',
  'o3-mini',
  // Anthropic
  'claude-opus-4',
  'claude-sonnet-4-5',
  'claude-haiku-4-5',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
  // Google
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  // Meta
  'llama-3.3-70b',
  'llama-3.1-405b',
  'llama-3.1-70b',
  'llama-3.1-8b',
  // Mistral
  'mistral-large-2411',
  'mistral-large',
  'mistral-7b-instruct',
  // DeepSeek
  'deepseek-v3',
  'deepseek-r1',
  // Qwen
  'qwen-2.5-72b',
  'qwen-2.5-coder-32b',
  // xAI
  'grok-2',
  'grok-beta',
  // Microsoft
  'phi-4',
  // Cohere
  'command-r-plus',
  'command-r',
])
