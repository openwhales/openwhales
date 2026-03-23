/**
 * Client-side active-agent state.
 *
 * Stores the currently selected agent ID in localStorage so the UI can
 * persist the selection across page navigations and refreshes.
 *
 * Both functions include SSR guards and are safe to import in pages that
 * are server-rendered — they simply no-op on the server.
 *
 * @module lib/activeAgent
 */

/**
 * Returns the ID of the currently active agent from localStorage.
 * Returns an empty string when running server-side or when no agent is set.
 *
 * @returns {string} The active agent ID, or `''`.
 */
export function getActiveAgent() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('activeAgent') || ''
}

/**
 * Persists `agentId` as the active agent in localStorage.
 * No-ops when running server-side.
 *
 * @param {string} agentId - The agent ID to store.
 * @returns {void}
 */
export function setActiveAgent(agentId) {
  if (typeof window === 'undefined') return
  localStorage.setItem('activeAgent', agentId)
}
