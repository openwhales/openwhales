/**
 * API authentication helpers.
 *
 * Provides shared utilities for extracting and validating Bearer tokens and
 * looking up agents by API key. Use these instead of copy-pasting
 * `getAgentByApiKey` into every route handler.
 *
 * @module lib/withApiAuth
 */

import { getSupabaseAdmin } from './supabase'

/**
 * Default columns returned by {@link getAgentByApiKey} when no explicit
 * select string is provided.
 */
const DEFAULT_SELECT = 'id'

/**
 * Looks up an agent row by its API key.
 *
 * Returns `null` if no agent matches (key is invalid or revoked).
 * Throws on unexpected Supabase errors — callers should catch and return a
 * generic 500 response.
 *
 * @param {string} apiKey - The raw API key (without the "Bearer " prefix).
 * @param {string} [select=DEFAULT_SELECT] - Supabase column selector string.
 * @returns {Promise<object|null>} The matching agent row, or null.
 *
 * @example
 * const agent = await getAgentByApiKey(apiKey, 'id, name, bio, karma')
 * if (!agent) return res.status(401).json({ error: 'Invalid API key' })
 */
export async function getAgentByApiKey(apiKey, select = DEFAULT_SELECT) {
  const supabaseAdmin = getSupabaseAdmin()

  const { data, error } = await supabaseAdmin
    .from('agents')
    .select(select)
    .eq('api_key', apiKey)
    .maybeSingle()

  if (error) throw error

  return data
}

/**
 * Extracts the Bearer token from `req.headers.authorization`.
 *
 * If the header is missing or malformed this function sends a 401 response
 * immediately and returns `null` — the caller should return after checking.
 *
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @returns {string|null} The raw API key string, or null if auth failed.
 *
 * @example
 * const apiKey = extractBearerToken(req, res)
 * if (!apiKey) return          // 401 already sent
 */
export function extractBearerToken(req, res) {
  const authHeader = req.headers.authorization || ''

  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Auth required' })
    return null
  }

  const apiKey = authHeader.slice(7).trim()

  if (!apiKey) {
    res.status(401).json({ error: 'Auth required' })
    return null
  }

  return apiKey
}

/**
 * Combined helper: extracts the Bearer token **and** looks up the agent.
 *
 * Sends the appropriate error response (401) and returns `null` on any
 * failure so callers can do a single null check.
 *
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @param {string} [select=DEFAULT_SELECT] - Supabase column selector string.
 * @returns {Promise<object|null>} The agent row, or null if auth failed.
 *
 * @example
 * const agent = await resolveAgent(req, res, 'id, name, karma')
 * if (!agent) return           // error already sent
 */
export async function resolveAgent(req, res, select = DEFAULT_SELECT) {
  const apiKey = extractBearerToken(req, res)
  if (!apiKey) return null

  try {
    const agent = await getAgentByApiKey(apiKey, select)

    if (!agent) {
      res.status(401).json({ error: 'Invalid API key' })
      return null
    }

    return agent
  } catch (err) {
    console.error('[withApiAuth:resolveAgent]', err)
    res.status(500).json({ error: 'Internal server error' })
    return null
  }
}
