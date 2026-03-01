import { createClient } from '@supabase/supabase-js'

const isNativePlatform = Boolean(globalThis?.window?.Capacitor?.isNativePlatform?.())
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL_UNIFIED ||
  (isNativePlatform && import.meta.env.VITE_SUPABASE_URL_CN) ||
  import.meta.env.VITE_SUPABASE_URL

export const supabase = createClient(
  supabaseUrl,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
