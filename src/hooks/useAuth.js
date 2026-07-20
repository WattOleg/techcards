import { useCallback, useEffect, useState } from 'react'
import supabase, { getSession, initAuth, isAuthRequired, isSupabaseConfigured } from '../api/supabaseClient'

/**
 * Session is restored from localStorage (persistSession) — no password on each open.
 * When VITE_AUTH_ENABLED is not true, auth is inert and the app behaves as before.
 */
export function useAuth() {
  const [loading, setLoading] = useState(isAuthRequired)
  const [session, setSession] = useState(null)

  const refreshAuth = useCallback(async () => {
    if (!isAuthRequired) {
      setLoading(false)
      setSession(null)
      return
    }

    setLoading(true)
    try {
      await initAuth()
      setSession(await getSession())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshAuth()
  }, [refreshAuth])

  useEffect(() => {
    if (!isAuthRequired) return undefined

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      data?.subscription?.unsubscribe?.()
    }
  }, [])

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
    refreshAuth,
    signOut,
    authRequired: isAuthRequired,
  }
}
