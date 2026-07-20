import { useCallback, useEffect, useRef, useState } from 'react'
import supabase, {
  getSession,
  isAuthRequired,
  isSupabaseConfigured,
  validateSession,
} from '../api/supabaseClient'

/**
 * Session from localStorage for fast open, then server re-check (ban → logout).
 * Re-validates when the app becomes visible again.
 */
export function useAuth() {
  const [loading, setLoading] = useState(isAuthRequired)
  const [session, setSession] = useState(null)
  const validatingRef = useRef(false)

  const runValidation = useCallback(async ({ showLoader = false } = {}) => {
    if (!isAuthRequired) {
      setLoading(false)
      setSession(null)
      return null
    }
    if (validatingRef.current) return null
    validatingRef.current = true
    if (showLoader) setLoading(true)
    try {
      const next = await validateSession()
      setSession(next)
      return next
    } finally {
      validatingRef.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthRequired) {
      setLoading(false)
      return undefined
    }

    let cancelled = false
    void (async () => {
      // 1) Instant restore from device storage (no password).
      const local = await getSession()
      if (cancelled) return
      if (local?.user) {
        setSession(local)
        setLoading(false)
      }
      // 2) Confirm with Supabase — banned / deleted users are signed out.
      await runValidation({ showLoader: !local?.user })
    })()

    return () => {
      cancelled = true
    }
  }, [runValidation])

  useEffect(() => {
    if (!isAuthRequired) return undefined

    const { data } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setLoading(false)
        return
      }
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        const ok = await validateSession()
        setSession(ok)
        setLoading(false)
        return
      }
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      data?.subscription?.unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    if (!isAuthRequired || typeof window === 'undefined') return undefined

    const recheck = () => {
      if (document.visibilityState === 'visible') {
        void runValidation({ showLoader: false })
      }
    }

    document.addEventListener('visibilitychange', recheck)
    window.addEventListener('focus', recheck)
    return () => {
      document.removeEventListener('visibilitychange', recheck)
      window.removeEventListener('focus', recheck)
    }
  }, [runValidation])

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return
    await supabase.auth.signOut()
    setSession(null)
  }, [])

  return {
    loading,
    session,
    user: session?.user ?? null,
    isAuthenticated: Boolean(session?.user),
    email: session?.user?.email || '',
    refreshAuth: runValidation,
    signOut,
    authRequired: isAuthRequired,
  }
}
