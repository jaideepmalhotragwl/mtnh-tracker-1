import { useCallback, useEffect, useState } from 'react'
import { supabase, errLine } from './supabase'
import { ALLOWED_COLUMNS, DATE_COLUMNS } from './constants'

// Strip anything the table doesn't have, and turn blank dates into null.
// This is what stops one stray field from failing a whole save.
function sanitize(obj) {
  const clean = {}
  for (const key of ALLOWED_COLUMNS) {
    if (obj[key] === undefined) continue
    const v = obj[key]
    clean[key] = (DATE_COLUMNS.has(key) && (v === '' || v === null)) ? null : (v ?? null)
  }
  if (clean.site_id) clean.site_id = String(clean.site_id).trim().toUpperCase()
  return clean
}

export const normSiteId = s => String(s || '').trim().toUpperCase()

export function useProjects() {
  const [sites,    setSites]    = useState([])
  const [evidence, setEvidence] = useState({})   // site_id → row from site_evidence
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) { setError(errLine(error)); return }
      setSites(data || [])

      // The view counts files in the database, so a card never has to fetch
      // its own photos to know whether it has any.
      const ev = await supabase.from('site_evidence').select('*')
      if (!ev.error && ev.data) {
        setEvidence(Object.fromEntries(ev.data.map(r => [r.site_id, r])))
      }
    } catch (err) {
      setError(`Can't reach the server — ${err.message}. Check the connection and reload.`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // A photo upload changes projects from inside the database, so the
  // browser has to hear about it. Without this the card would not move
  // until someone refreshed.
  useEffect(() => {
    const ch = supabase
      .channel('projects-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'site_photos' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  async function saveSite(row) {
    const payload = sanitize(row)

    if (row.id) {
      const { error } = await supabase.from('projects').update(payload).eq('id', row.id)
      if (error) throw new Error(errLine(error))
    } else {
      const { error } = await supabase.from('projects').insert(payload)
      if (error) {
        if (error.code === '23505' || /duplicate key/i.test(error.message || '')) {
          throw new Error(`${payload.site_id} is already in the tracker.`)
        }
        throw new Error(errLine(error))
      }
    }
    await load()
  }

  // Excel import.
  //
  // Matched on site ID, but the database's unique index is on
  // upper(trim(site_id)) — which an ON CONFLICT clause cannot target. So
  // the match happens here: existing rows carry their id and go through
  // as updates, genuinely new rows go through as inserts. Chunked at 50,
  // because one 500-row request times out.
  async function importRows(rows, onProgress) {
    const clean = rows.map(sanitize).filter(r => r.site_id)
    if (!clean.length) return 0

    // Last row wins if the same site ID appears twice in one sheet.
    const byId = new Map()
    for (const r of clean) byId.set(r.site_id, r)
    const unique = [...byId.values()]

    const { data: existing, error: exErr } = await supabase
      .from('projects').select('id, site_id')
    if (exErr) throw new Error(errLine(exErr))

    const idOf = new Map((existing || []).map(r => [normSiteId(r.site_id), r.id]))

    const inserts = []
    const updates = []
    for (const r of unique) {
      const id = idOf.get(r.site_id)
      if (id) updates.push({ ...r, id })
      else inserts.push(r)
    }

    let done = 0
    const CHUNK = 50
    const total = unique.length

    for (let i = 0; i < inserts.length; i += CHUNK) {
      const slice = inserts.slice(i, i + CHUNK)
      const { error } = await supabase.from('projects').insert(slice)
      if (error) throw new Error(`New sites, row ${i + 1}: ${errLine(error)}`)
      done += slice.length
      onProgress?.(done, total)
    }

    for (let i = 0; i < updates.length; i += CHUNK) {
      const slice = updates.slice(i, i + CHUNK)
      const { error } = await supabase
        .from('projects').upsert(slice, { onConflict: 'id' })
      if (error) throw new Error(`Existing sites, row ${i + 1}: ${errLine(error)}`)
      done += slice.length
      onProgress?.(done, total)
    }

    await load()
    return done
  }

  async function deleteSite(id) {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) throw new Error(errLine(error))
    await load()
  }

  return { sites, evidence, loading, error, reload: load, saveSite, importRows, deleteSite }
}
