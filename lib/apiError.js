export function apiError(res, status = 400, message = "Error") {
  return res.status(status).json({
    success: false,
    error: message
  })
}