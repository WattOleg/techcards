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

export async function initAuth() {
  if (!isSupabaseConfigured) return null
  return getSession()
}

export default supabase
