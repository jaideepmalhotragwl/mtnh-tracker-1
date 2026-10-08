import { createClient } from '@supabase/supabase-js'

// Supabase moved from the old eyJ... anon keys to sb_publishable_... keys.
// The old kind returns 401 on every call. These are the live values; the
// Amplify environment variables override them when they are set.
const URL = import.meta.env.VITE_SUPABASE_URL
  || 'https://qirnaacfohmwkuqzgjwb.supabase.co'

const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'sb_publishable_lFYemRxLFhtkKF-GiT59Gw_qHvYguc3'

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: false }
})

export const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || 'mtnh2024'

export const PHOTO_BUCKET = 'site-photos'

// Supabase errors arrive as objects. Turn one into a line a person can read,
// keeping the HTTP status, because the status is what tells you whether it is
// a bad key (401), a missing column (400) or row security (403).
export function errLine(error) {
  if (!error) return ''
  const bits = [error.code, error.message, error.details, error.hint]
    .map(v => (v == null ? '' : String(v).trim()))
    .filter(Boolean)
  // Supabase often repeats the same text in message and details.
  return [...new Set(bits)].join(' · ') || 'Unknown error'
}
