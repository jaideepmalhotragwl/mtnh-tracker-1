import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { FALLBACK_VENDORS, FALLBACK_PEOPLE } from './constants'

// ─────────────────────────────────────────────────────────────────
// ONE PLACE FOR THE THINGS EVERY SCREEN NEEDS
//
// vendors, people and photo stages are read from the database, not
// hardcoded, so adding one in Settings changes every dropdown in the
// app without a deploy. That is requirement R6.
//
// `vendor` is the selected vendor from the bar at the top. It scopes
// the Tracker and the Warehouse. It deliberately does NOT scope the
// Team Room — the team is seven people and one conversation.
// ─────────────────────────────────────────────────────────────────

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function AppProvider({ children }) {
  const [vendor,  setVendor]  = useState('All')
  const [me,      setMe]      = useState(() => localStorage.getItem('mtnh_me') || '')
  const [vendors, setVendors] = useState([])
  const [people,  setPeople]  = useState([])
  const [stages,  setStages]  = useState([])
  const [ready,   setReady]   = useState(false)
  const [warn,    setWarn]    = useState('')

  const loadLists = useCallback(async () => {
    function fallback(msg) {
      setWarn(msg)
      setVendors(FALLBACK_VENDORS.map((name, i) => ({ name, active: true, sort_order: i })))
      setPeople(FALLBACK_PEOPLE.map(name => ({ name, initials: name[0], active: true })))
      setStages([])
    }

    try {
      const [v, p, s] = await Promise.all([
        supabase.from('vendors').select('*').order('sort_order'),
        supabase.from('room_users').select('*').order('name'),
        supabase.from('photo_stages').select('*').order('sort_order')
      ])

      if (v.error || p.error || s.error) {
        // Almost always means mtnh_setup.sql hasn't been run yet.
        fallback('Settings tables not found — run mtnh_setup.sql in Supabase.')
      } else {
        setWarn('')
        setVendors(v.data || [])
        setPeople(p.data || [])
        setStages(s.data || [])
      }
    } catch (err) {
      fallback(`Can't reach the server — ${err.message}. Showing the built-in lists until it's back.`)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => { loadLists() }, [loadLists])

  function pickMe(name) {
    setMe(name)
    localStorage.setItem('mtnh_me', name)
  }

  const activeVendors = vendors.filter(v => v.active !== false)
  const activePeople  = people.filter(p => p.active !== false)
  const activeStages  = stages.filter(s => s.active !== false)

  const meRecord = people.find(p => p.name === me) || null
  const isAdmin  = !!(meRecord && meRecord.is_admin)

  return (
    <Ctx.Provider value={{
      vendor, setVendor,
      me, pickMe, meRecord, isAdmin,
      vendors, activeVendors,
      people,  activePeople,
      stages,  activeStages,
      stageByKey: Object.fromEntries(stages.map(s => [s.key, s])),
      ready, warn, reloadLists: loadLists
    }}>
      {children}
    </Ctx.Provider>
  )
}

// Resolve any spelling of a vendor to the real name. Mirrors the
// vendor_name() function in the database so chat and the browser agree.
export function resolveVendor(vendors, text) {
  if (!text) return null
  const t = String(text).trim().toLowerCase()
  for (const v of vendors) {
    if (v.name.toLowerCase() === t) return v.name
    if ((v.aliases || []).some(a => String(a).toLowerCase() === t)) return v.name
  }
  return null
}
