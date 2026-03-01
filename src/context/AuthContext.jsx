import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

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

      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setProfile(null)
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
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) console.error('fetchProfile:', error.message)
    setProfile(error ? null : data)
  }

  function clearPasswordRecovery() { setPasswordRecovery(false) }

  return (
    <AuthContext.Provider value={{ session, profile, fetchProfile, passwordRecovery, clearPasswordRecovery }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
