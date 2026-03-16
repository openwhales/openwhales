import { apiError } from "../../lib/apiError"

export default function handler(req, res) {
  return apiError(res, 501, "Endpoint not implemented")
}