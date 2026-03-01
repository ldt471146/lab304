import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)
const SESSION_TIMEOUT_MS = 12000
const PROFILE_TIMEOUT_MS = 10000

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs)
    }),
  ])
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(undefined)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    async function initFromUrlAndHydrateSession() {
      // Handle PKCE code / token_hash / hash-based access token callbacks.
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const tokenHash = params.get('token_hash')
      const type = params.get('type')
      const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      try {
        if (code) {
          await supabase.auth.exchangeCodeForSession(code)
        } else if (tokenHash) {
          await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type || 'email' })
        } else if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
        }
      } catch (e) {
        console.error('auth callback handling failed:', e?.message || e)
      }

      if (code || tokenHash || accessToken) {
        window.history.replaceState({}, '', window.location.pathname)
      }

      try {
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          SESSION_TIMEOUT_MS,
          'getSession'
        )
        setSession(session)
        if (session) await fetchProfile(session.user.id)
        else setProfile(null)
      } catch (e) {
        console.error('hydrate session failed:', e?.message || e)
        // Never keep bootstrap state as undefined, otherwise UI can be stuck on loading.
        setSession(null)
        setProfile(null)
      }
    }

    initFromUrlAndHydrateSession()

    // Single source of truth: onAuthStateChange handles all session updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true)
      }
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
        PROFILE_TIMEOUT_MS,
        'fetchProfile'
      )
      if (error) console.error('fetchProfile:', error.message)
      setProfile(error ? null : data)
    } catch (e) {
      console.error('fetchProfile failed:', e?.message || e)
      setProfile(null)
    }
  }

  function clearPasswordRecovery() { setPasswordRecovery(false) }

  return (
    <AuthContext.Provider value={{ session, profile, fetchProfile, passwordRecovery, clearPasswordRecovery }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
