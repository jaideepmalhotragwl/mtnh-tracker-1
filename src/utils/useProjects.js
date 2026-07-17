import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { newProject } from './stageLogic'

const TABLE = 'projects'

export function useProjects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load all projects on mount
  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setProjects(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Add a new project
  const add = useCallback(async (data) => {
    const project = newProject(data)
    delete project.id // let Supabase generate UUID
    const { data: created, error } = await supabase
      .from(TABLE)
      .insert([project])
      .select()
      .single()
    if (error) throw error
    setProjects(prev => [created, ...prev])
    return created
  }, [])

  // Update existing project
  const update = useCallback(async (id, data) => {
    const { data: updated, error } = await supabase
      .from(TABLE)
      .update(data)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setProjects(prev => prev.map(p => p.id === id ? updated : p))
    return updated
  }, [])

  // Delete project
  const remove = useCallback(async (id) => {
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) throw error
    setProjects(prev => prev.filter(p => p.id !== id))
  }, [])

  // Bulk import from Excel
  const importRows = useCallback(async (rows) => {
    // Deduplicate by site_id against existing
    const existingIds = new Set(projects.map(p => p.site_id).filter(Boolean))
    const fresh = rows.filter(r => !r.site_id || !existingIds.has(r.site_id))
    if (fresh.length === 0) return 0
    const clean = fresh.map(r => { const p = { ...r }; delete p.id; return p })
    const { data, error } = await supabase.from(TABLE).insert(clean).select()
    if (error) throw error
    setProjects(prev => [...(data || []), ...prev])
    return data?.length || 0
  }, [projects])

  // Apply real-time update from subscription
  const applyRealtimeEvent = useCallback((event) => {
    if (event.eventType === 'INSERT') {
      setProjects(prev => {
        if (prev.find(p => p.id === event.new.id)) return prev
        return [event.new, ...prev]
      })
    } else if (event.eventType === 'UPDATE') {
      setProjects(prev => prev.map(p => p.id === event.new.id ? event.new : p))
    } else if (event.eventType === 'DELETE') {
      setProjects(prev => prev.filter(p => p.id !== event.old.id))
    }
  }, [])

  return { projects, loading, error, add, update, remove, importRows, applyRealtimeEvent, reload: loadProjects }
}
