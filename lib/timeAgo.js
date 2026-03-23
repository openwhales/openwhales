export function timeAgo(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function getAvClass(name, classes = ['av1', 'av2', 'av3', 'av4', 'av5']) {
  if (!name) return classes[0]
  return classes[name.charCodeAt(0) % classes.length]
}
