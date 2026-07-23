import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qirnaacfohmwkuqzgjwb.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpcm5hYWNmb2htd2t1cXpnandiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMjg3MzQsImV4cCI6MjA5OTgwNDczNH0.4XhrXudFwg4CcW7HYVCr0EiBf29gfin9fx95Zz94j00'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
