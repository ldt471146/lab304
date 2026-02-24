import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(undefined) // undefined=加载中, null=无资料, object=有资料

  useEffect(() => {
    // Handle PKCE code or token_hash from email confirmation redirect
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const tokenHash = params.get('token_hash')
    const type = params.get('type')

    const handleCallback = async () => {
      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
      } else if (tokenHash) {
        await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type || 'email' })
      }
      // Clean URL params after handling
      if (code || tokenHash) {
        window.history.replaceState({}, '', window.location.pathname)
      }
    }

    handleCallback().then(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
        if (session) fetchProfile(session.user.id)
        else { setSession(null); setProfile(null) }
      })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setProfile(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    setProfile(error ? null : data)
  }

  return (
    <AuthContext.Provider value={{ session, profile, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
