import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
/** Publishable / anon key only — never put sb_secret / service_role in the client. */
const SUPABASE_ANON_KEY = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
).trim()

/** Set VITE_AUTH_ENABLED=true to require login (see .env / .env.production). */
export const isAuthEnabled =
  String(import.meta.env.VITE_AUTH_ENABLED || '').trim().toLowerCase() === 'true'

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

/** Auth gate is on only when keys exist AND the flag is enabled. */
export const isAuthRequired = isAuthEnabled && isSupabaseConfigured

const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    })
  : {
      auth: {
        async getSession() {
          return { data: { session: null }, error: null }
        },
        async getUser() {
          return { data: { user: null }, error: null }
        },
        async signInWithPassword() {
          return { data: { user: null, session: null }, error: { message: 'Supabase не настроен' } }
        },
        async signUp() {
          return { data: { user: null, session: null }, error: { message: 'Supabase не настроен' } }
        },
        async signOut() {
          return { error: null }
        },
        async resetPasswordForEmail() {
          return { data: {}, error: { message: 'Supabase не настроен' } }
        },
        async updateUser() {
          return { data: { user: null }, error: { message: 'Supabase не настроен' } }
        },
        onAuthStateChange(callback) {
          callback('INITIAL_SESSION', null)
          return {
            data: {
              subscription: {
                unsubscribe() {},
              },
            },
          }
        },
      },
    }

export async function getSession() {
  const result = await supabase.auth.getSession()
  return result?.data?.session ?? null
}

function isBannedUser(user) {
  if (!user) return false
  const bannedUntil = user.banned_until || user.ban_duration
  if (!bannedUntil) return false
  if (bannedUntil === 'none' || bannedUntil === 'null') return false
  const ts = Date.parse(String(bannedUntil))
  if (Number.isNaN(ts)) return true
  return ts > Date.now()
}

function isAuthRejection(error) {
  if (!error) return false
  const msg = String(error.message || error.error_description || error.code || '').toLowerCase()
  const status = error.status || error.statusCode
  if (status === 401 || status === 403) return true
  return (
    msg.includes('banned') ||
    msg.includes('user_banned') ||
    msg.includes('user is banned') ||
    msg.includes('invalid jwt') ||
    msg.includes('jwt expired') ||
    msg.includes('session') && msg.includes('not') ||
    msg.includes('refresh_token') ||
    msg.includes('user not found') ||
    msg.includes('user_not_found')
  )
}

/**
 * Local session from storage, then server check via getUser().
 * Banned / deleted employees lose access even with an old device session.
 */
export async function validateSession() {
  if (!isSupabaseConfigured) return null

  const local = await getSession()
  if (!local?.access_token) return null

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    if (isAuthRejection(error) || !data?.user) {
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch {
        // ignore
      }
    }
    return null
  }

  if (isBannedUser(data.user)) {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      // ignore
    }
    return null
  }

  // Prefer fresh session after possible token refresh during getUser.
  return (await getSession()) || local
}

export async function initAuth() {
  if (!isSupabaseConfigured) return null
  return validateSession()
}

export default supabase
