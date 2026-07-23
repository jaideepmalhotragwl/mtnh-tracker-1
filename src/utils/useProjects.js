import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { newProject } from './stageLogic'

const TABLE = 'projects'

// Only these columns exist in Supabase — strip everything else before insert/update
const ALLOWED_COLUMNS = new Set([
  'site_id','site_name','circle','site_type','toco','zone','city','district','layer',
  'email_received_date','email_content',
  'listed_on_ultro','email_sent_to_client',
  'team_assigned','team_name','team_number',
  'work_initiated','work_date',
  'advance_amount','advance_date','advance_mode',
  'balance_amount','balance_date','balance_mode',
  'material_received','material_received_date',
  'packing_done','packing_date','packing_photo_url',
  'dc_received','dc_number',
  'sreq_done','sreq_date','sreq_number',
  'material_submitted','material_submitted_date',
  'signed_dc_received','signed_dc_date','signed_dc_url',
  'po_received','po_date','po_number',
  'all_tasks_ultro','pending_tasks',
  'wcc_received','wcc_date','wcc_number','wcc_remark',
  'invoice_done','invoice_date','invoice_number',
  'payment_received','payment_date','payment_amount','remarks',
  'billing_status','source_sheet',
])

function sanitize(obj) {
  const clean = {}
  for (const key of ALLOWED_COLUMNS) {
    if (obj[key] !== undefined) {
      // Convert empty strings to null for date fields
      const isDate = key.endsWith('_date')
      clean[key] = (isDate && obj[key] === '') ? null : (obj[key] ?? null)
    }
  }
  return clean
}

export function useProjects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { loadProjects() }, [])

  async function loadProjects() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from(TABLE).select('*').order('created_at', { ascending: false })
      if (error) throw error
      setProjects(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const add = useCallback(async (data) => {
    const project = sanitize(newProject(data))
    const { data: created, error } = await supabase
      .from(TABLE).insert([project]).select().single()
    if (error) throw error
    setProjects(prev => [created, ...prev])
    return created
  }, [])

  const update = useCallback(async (id, data) => {
    const clean = sanitize(data)
    const { data: updated, error } = await supabase
      .from(TABLE).update(clean).eq('id', id).select().single()
    if (error) throw error
    setProjects(prev => prev.map(p => p.id === id ? updated : p))
    return updated
  }, [])

  const remove = useCallback(async (id) => {
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) throw error
    setProjects(prev => prev.filter(p => p.id !== id))
  }, [])

  const importRows = useCallback(async (rows) => {
    const existingIds = new Set(projects.map(p => p.site_id).filter(Boolean))
    const fresh = rows.filter(r => !r.site_id || !existingIds.has(r.site_id))
    if (fresh.length === 0) return 0

    // Sanitize and batch insert in chunks of 50 to avoid timeouts
    const clean = fresh.map(r => sanitize(r))
    const CHUNK = 50
    let inserted = []
    for (let i = 0; i < clean.length; i += CHUNK) {
      const chunk = clean.slice(i, i + CHUNK)
      const { data, error } = await supabase.from(TABLE).insert(chunk).select()
      if (error) throw error
      inserted = [...inserted, ...(data || [])]
    }
    setProjects(prev => [...inserted, ...prev])
    return inserted.length
  }, [projects])

  const applyRealtimeEvent = useCallback((event) => {
    if (event.eventType === 'INSERT') {
      setProjects(prev => prev.find(p => p.id === event.new.id) ? prev : [event.new, ...prev])
    } else if (event.eventType === 'UPDATE') {
      setProjects(prev => prev.map(p => p.id === event.new.id ? event.new : p))
    } else if (event.eventType === 'DELETE') {
      setProjects(prev => prev.filter(p => p.id !== event.old.id))
    }
  }, [])

  return { projects, loading, error, add, update, remove, importRows, applyRealtimeEvent, reload: loadProjects }
}
