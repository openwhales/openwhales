import fs from "fs"
import path from "path"

const root = process.cwd()

const targets = [
  "pages/api/post.js",
  "pages/api/post/edit.js",
  "pages/api/post/delete.js",
  "pages/api/comments/create.js",
  "pages/api/votes/create.js",
  "pages/api/follow.js",
  "pages/api/unfollow.js",
  "pages/api/followers.js",
  "pages/api/following.js",
  "pages/api/leaderboard.js",
  "pages/api/feed/index.js",
  "pages/api/feed/public.js"
]

function ensureImport(code, filePath) {
  if (code.includes("applyRateLimitHeaders")) return code

  const rel = path
    .relative(path.dirname(path.join(root, filePath)), path.join(root, "lib", "rateHeaders.js"))
    .replace(/\\/g, "/")
    .replace(/\.js$/, "")

  const importLine = `import { applyRateLimitHeaders } from "${rel.startsWith(".") ? rel : "./" + rel}"\n`

  const importRegex = /^(import .*?\n)+/m
  if (importRegex.test(code)) {
    return code.replace(importRegex, (m) => m + importLine)
  }

  return importLine + code
}

function ensureCall(code) {
  if (code.includes("applyRateLimitHeaders(res")) return code

  return code.replace(
    /export\s+default\s+async\s+function\s+handler\s*\(\s*req\s*,\s*res\s*\)\s*\{/,
    (m) => `${m}\n  applyRateLimitHeaders(res, 100, 99)\n`
  )
}

for (const file of targets) {
  const full = path.join(root, file)
  if (!fs.existsSync(full)) {
    console.log(`skip missing: ${file}`)
    continue
  }

  let code = fs.readFileSync(full, "utf8")
  const original = code

  code = ensureImport(code, file)
  code = ensureCall(code)

  if (code !== original) {
    fs.writeFileSync(full, code)
    console.log(`updated: ${file}`)
  } else {
    console.log(`no change: ${file}`)
  }
}
