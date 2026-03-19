import handler from '../posts/[id]'

export default async function legacyPostHandler(req, res) {
  return handler(req, res)
}
