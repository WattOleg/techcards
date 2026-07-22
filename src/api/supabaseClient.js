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

const AUTH_LOCK_NAME = 'tk-supabase-auth-refresh'
const AUTH_LOCK_STORAGE_KEY = 'tk_supabase_refresh_lock_v1'
const AUTH_CHANNEL_NAME = 'tk-supabase-auth'

let supabaseSingleton = null
let authDebugBound = false
let visibilityBound = false
let crossTabBound = false

function createStubClient() {
  return {
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
      startAutoRefresh() {},
      stopAutoRefresh() {},
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
}

/** Step 1: one createClient for the whole app. */
function getSupabaseClient() {
  if (supabaseSingleton) return supabaseSingleton

  if (!isSupabaseConfigured) {
    supabaseSingleton = createStubClient()
    return supabaseSingleton
  }

  supabaseSingleton = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      flowType: 'pkce',
    },
  })

  bindAuthDebugLogger(supabaseSingleton)
  bindVisibilityAutoRefresh(supabaseSingleton)
  bindCrossTabAuthSync(supabaseSingleton)

  return supabaseSingleton
}

export const supabase = getSupabaseClient()
export default supabase

export async function getSession() {
  const result = await supabase.auth.getSession()
  return result?.data?.session ?? null
}

function isBannedUser(user) {
  if (!user) return false
  const bannedUntil = user.banned_until
  if (bannedUntil == null || bannedUntil === '' || bannedUntil === 'none' || bannedUntil === 'null') {
    return false
  }
  const ts = Date.parse(String(bannedUntil))
  if (Number.isNaN(ts)) return true
  return ts > Date.now()
}

/** Only hard-kill session on definitive account blocks — not on flaky network. */
function isDefinitiveAccessRevoked(error) {
  if (!error) return false
  const msg = String(error.message || error.error_description || error.code || '').toLowerCase()
  return (
    msg.includes('banned') ||
    msg.includes('user_banned') ||
    msg.includes('user is banned') ||
    msg.includes('user not found') ||
    msg.includes('user_not_found') ||
    msg.includes('user_deleted') ||
    msg.includes('session_not_found') ||
    msg.includes('invalid refresh token') ||
    msg.includes('refresh_token_not_found')
  )
}

/**
 * Local session first; server check must NOT wipe session on transient network errors
 * (that was causing random auto-logouts).
 */
export async function validateSession() {
  if (!isSupabaseConfigured) return null

  const local = await getSession()
  if (!local?.access_token) return null

  try {
    const { data, error } = await withAuthRefreshLock(() => supabase.auth.getUser())

    if (error) {
      if (isDefinitiveAccessRevoked(error)) {
        console.warn('[AUTH] access revoked → local signOut', error.message || error)
        try {
          await supabase.auth.signOut({ scope: 'local' })
        } catch {
          // ignore
        }
        return null
      }
      // Network / transient — keep device session so barista stays logged in.
      console.warn('[AUTH] getUser transient error, keeping session', error.message || error)
      return local
    }

    if (!data?.user) {
      console.warn('[AUTH] getUser returned no user without error — keeping local session')
      return local
    }

    if (isBannedUser(data.user)) {
      console.warn('[AUTH] user banned_until active → local signOut')
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch {
        // ignore
      }
      return null
    }

    return (await getSession()) || local
  } catch (err) {
    console.warn('[AUTH] validateSession network/exception — keeping session', err)
    return local
  }
}

export async function initAuth() {
  if (!isSupabaseConfigured) return null
  return validateSession()
}

/** Step 2: pause refresh in background tabs; resume when visible. */
function bindVisibilityAutoRefresh(client) {
  if (visibilityBound || typeof document === 'undefined') return
  visibilityBound = true

  const sync = () => {
    try {
      if (document.visibilityState === 'visible') {
        client.auth.startAutoRefresh?.()
      } else {
        client.auth.stopAutoRefresh?.()
      }
    } catch (err) {
      console.warn('[AUTH] autoRefresh toggle failed', err)
    }
  }

  document.addEventListener('visibilitychange', sync)
  sync()
}

/** Diagnosis logger (temporary). */
function bindAuthDebugLogger(client) {
  if (authDebugBound) return
  authDebugBound = true
  client.auth.onAuthStateChange((event, session) => {
    console.log(
      '[AUTH EVENT]',
      event,
      new Date().toISOString(),
      session ? 'session exists' : 'NO SESSION',
    )
  })
}

/**
 * Step 3: only one tab refreshes / validates at a time
 * (Web Locks → BroadcastChannel → localStorage lock).
 */
async function withAuthRefreshLock(fn) {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(AUTH_LOCK_NAME, { mode: 'exclusive' }, () => fn())
  }

  if (typeof localStorage === 'undefined') {
    return fn()
  }

  const myId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const now = Date.now()
  try {
    const raw = localStorage.getItem(AUTH_LOCK_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (parsed?.owner && parsed.expiresAt > now && parsed.owner !== myId) {
      // Another tab holds the lock — wait briefly then run (read path is ok to overlap lightly).
      await new Promise((r) => setTimeout(r, 120 + Math.random() * 180))
      return fn()
    }
    localStorage.setItem(
      AUTH_LOCK_STORAGE_KEY,
      JSON.stringify({ owner: myId, expiresAt: now + 4000 }),
    )
  } catch {
    return fn()
  }

  try {
    return await fn()
  } finally {
    try {
      const raw = localStorage.getItem(AUTH_LOCK_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      if (parsed?.owner === myId) localStorage.removeItem(AUTH_LOCK_STORAGE_KEY)
    } catch {
      // ignore
    }
  }
}

/** Keep tabs in sync when one signs out / refreshes. */
function bindCrossTabAuthSync(client) {
  if (crossTabBound || typeof window === 'undefined') return
  crossTabBound = true

  let channel = null
  try {
    channel = new BroadcastChannel(AUTH_CHANNEL_NAME)
  } catch {
    channel = null
  }

  client.auth.onAuthStateChange((event, session) => {
    try {
      channel?.postMessage({
        type: 'auth',
        event,
        hasSession: Boolean(session),
        at: Date.now(),
      })
    } catch {
      // ignore
    }
  })

  if (channel) {
    channel.onmessage = (msg) => {
      const data = msg?.data
      if (!data || data.type !== 'auth') return
      if (data.event === 'SIGNED_OUT') {
        // Force local React state via getSession → null on next tick consumers.
        void client.auth.getSession()
      }
    }
  }

  window.addEventListener('storage', (event) => {
    // Supabase persists auth under sb-*-auth-token; when another tab updates it, reload session.
    if (!event.key || !event.key.includes('auth-token')) return
    void client.auth.getSession()
  })
}
