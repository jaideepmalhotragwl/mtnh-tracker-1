import { useState, useMemo, useCallback } from 'react'
import PasswordGate   from './components/PasswordGate'
import Header         from './components/Header'
import StatsBar       from './components/StatsBar'
import Toolbar        from './components/Toolbar'
import KanbanBoard    from './components/KanbanBoard'
import ListView       from './components/ListView'
import FieldView      from './components/FieldView'
import ProjectForm    from './components/ProjectForm'
import UploadModal    from './components/UploadModal'
import ConfigModal    from './components/ConfigModal'
import Overlay        from './components/Overlay'
import Toast          from './components/Toast'
import { useProjects }  from './utils/useProjects'
import { useRealtime }  from './utils/useRealtime'
import { useToast }     from './utils/useToast'
import { exportToSheets } from './utils/sheets'
import { getStage, isNotAssigned, getMissingStages } from './utils/stageLogic'

export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('mtnh_auth') === '1')
  if (!authed) return <PasswordGate onUnlock={() => setAuthed(true)} />
  return <Tracker />
}

function Tracker() {
  const { projects, loading, add, update, remove, importRows, applyRealtimeEvent } = useProjects()
  const { toast, show: showToast } = useToast()

  // Real-time handler
  const handleRealtimeEvent = useCallback((event) => {
    applyRealtimeEvent(event)
    if (event.eventType === 'UPDATE') {
      const name = event.new?.site_name || event.new?.site_id || 'A site'
      showToast(`↻ ${name} updated`, 'realtime')
    }
  }, [applyRealtimeEvent, showToast])

  useRealtime(handleRealtimeEvent)

  // UI state
  const [view,    setView]   = useState('kanban')
  const [modal,   setModal]  = useState(null)
  const [editId,  setEditId] = useState(null)
  const [exporting, setExporting] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [zone,   setZone]   = useState('')
  const [team,   setTeam]   = useState('')
  const [filter, setFilter] = useState('')

  const zones = useMemo(() => [...new Set(projects.map(p => p.zone).filter(Boolean))].sort(), [projects])
  const teams = useMemo(() => [...new Set(projects.map(p => p.team_name).filter(Boolean))].sort(), [projects])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return projects.filter(p => {
      if (q && !(p.site_name || '').toLowerCase().includes(q) && !(p.site_id || '').toLowerCase().includes(q)) return false
      if (zone && p.zone !== zone) return false
      if (team && p.team_name !== team) return false
      if (filter === 'not_assigned' && !isNotAssigned(p)) return false
      if (filter === 'warnings' && getMissingStages(p).length === 0) return false
      if (filter === 'wcc' && p.wcc_received !== 'Pending' && !(p.all_tasks_ultro === 'Yes' && p.wcc_received !== 'Yes')) return false
      if (filter === 'invoice' && !(p.wcc_received === 'Yes' && p.invoice_done !== 'Yes')) return false
      return true
    })
  }, [projects, search, zone, team, filter])

  function openAdd()     { setEditId(null); setModal('form') }
  function openEdit(id)  { setEditId(id);   setModal('form') }
  function closeModal()  { setModal(null);  setEditId(null)  }

  async function handleSave(data) {
    try {
      if (editId) { await update(editId, data); showToast('✓ Site updated') }
      else        { await add(data);             showToast('✓ Site added') }
      closeModal()
    } catch (err) { showToast('Error: ' + err.message, 'error') }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this site? This cannot be undone.')) return
    try { await remove(id); showToast('Site deleted'); closeModal() }
    catch (err) { showToast('Error: ' + err.message, 'error') }
  }

  async function handleImport(rows) {
    try {
      const n = await importRows(rows)
      showToast(`✓ ${n} sites imported to Supabase`)
    } catch (err) { const msg = err?.message || err?.details || err?.hint || JSON.stringify(err) || "Unknown error"; console.error("Import error:", err); showToast("Import failed: " + msg, "error") }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const n = await exportToSheets(projects)
      showToast(`✓ ${n} projects exported to Google Sheets`, 'realtime')
    } catch (err) { showToast('Export failed: ' + err.message, 'error') }
    finally { setExporting(false) }
  }

  const editProject = editId ? projects.find(p => p.id === editId) : null

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--muted)', fontSize: 14 }}>
      Loading projects…
    </div>
  )

  return (
    <>
      <Header
        onAdd={openAdd}
        onUpload={() => setModal('upload')}
        onConfig={() => setModal('config')}
        onExport={handleExport}
        exporting={exporting}
        isLive
      />

      <StatsBar projects={filtered} />

      <Toolbar
        search={search} onSearch={setSearch}
        zone={zone}     onZone={setZone}
        team={team}     onTeam={setTeam}
        filter={filter} onFilter={setFilter}
        zones={zones}   teams={teams}
        view={view}     onView={setView}
      />

      {view === 'kanban' && <KanbanBoard projects={filtered} onOpen={openEdit} />}
      {view === 'list'   && <ListView   projects={filtered} onOpen={openEdit} />}
      {view === 'field'  && <FieldView  projects={filtered} onOpen={openEdit} />}

      {modal === 'form' && (
        <Overlay onClose={closeModal}>
          <ProjectForm
            project={editProject || null}
            onSave={handleSave}
            onDelete={handleDelete}
            onClose={closeModal}
          />
        </Overlay>
      )}

      {modal === 'upload' && (
        <Overlay onClose={closeModal}>
          <UploadModal onImport={handleImport} onClose={closeModal} />
        </Overlay>
      )}

      {modal === 'config' && (
        <Overlay onClose={closeModal}>
          <ConfigModal onClose={closeModal} onExport={() => { closeModal(); handleExport() }} />
        </Overlay>
      )}

      <Toast toast={toast} />
    </>
  )
}
