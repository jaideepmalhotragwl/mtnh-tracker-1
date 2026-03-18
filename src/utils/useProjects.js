import { useState, useCallback } from 'react'
import { newProject, mapExcelRow } from '../utils/stageLogic'

const STORAGE_KEY = 'mtnh_projects'

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function persist(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function useProjects() {
  const [projects, setProjects] = useState(load)

  const set = useCallback(fn => {
    setProjects(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn
      persist(next)
      return next
    })
  }, [])

  const add = useCallback(data => {
    set(prev => [...prev, newProject(data)])
  }, [set])

  const update = useCallback((id, data) => {
    set(prev => prev.map(p => p._id === id ? { ...p, ...data } : p))
  }, [set])

  const remove = useCallback(id => {
    set(prev => prev.filter(p => p._id !== id))
  }, [set])

  const importRows = useCallback(rows => {
    const mapped = rows.map(mapExcelRow)
    set(prev => {
      const existingIds = new Set(prev.map(p => p.siteId).filter(Boolean))
      const fresh = mapped.filter(p => !p.siteId || !existingIds.has(p.siteId))
      return [...prev, ...fresh]
    })
    return mapped.length
  }, [set])

  const replaceAll = useCallback(data => {
    set(data)
  }, [set])

  return { projects, add, update, remove, importRows, replaceAll, setProjects: set }
}
