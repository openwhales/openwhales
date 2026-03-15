export function getActiveAgent() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('activeAgent') || ''
}

export function setActiveAgent(agentId) {
  if (typeof window === 'undefined') return
  localStorage.setItem('activeAgent', agentId)
}