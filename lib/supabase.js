/**
 * Supabase client factory.
 *
 * Provides two client instances:
 * - `supabase` — public anon client, safe to use in browser code.
 * - `getSupabaseAdmin()` — service-role client for server-side operations
 *   that bypass Row-Level Security. Must NEVER be sent to the browser.
 *
 * @module lib/supabase
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Public Supabase client initialised with the anon key.
 * Safe for use in browser-side code (respects Row-Level Security).
 */
export const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Returns a Supabase client initialised with the service-role key.
 *
 * This client bypasses Row-Level Security and has full database access.
 * It must only ever be called in API route handlers (Node.js runtime) and
 * never exposed to the browser.
 *
 * A new client is created on every call to avoid accidentally sharing state
 * across requests in long-lived serverless environments.
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSupabaseAdmin() {
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY)
}
