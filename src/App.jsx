import { useState, useMemo } from 'react'
import PasswordGate    from './components/PasswordGate'
import Header          from './components/Header'
import StatsBar        from './components/StatsBar'
import Toolbar         from './components/Toolbar'
import KanbanBoard     from './components/KanbanBoard'
import ListView        from './components/ListView'
import FieldView       from './components/FieldView'
import ProjectForm     from './components/ProjectForm'
import UploadModal     from './components/UploadModal'
import ConfigModal     from './components/ConfigModal'
import Overlay         from './components/Overlay'
import Toast           from './components/Toast'
import { useProjects } from './utils/useProjects'
import { useToast }    from './utils/useToast'
import { loadConfig, fetchFromSheets, pushToSheets } from './utils/sheets'

export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('mtnh_auth') === '1')

  if (!authed) return <PasswordGate onUnlock={() => setAuthed(true)} />
  return <Tracker />
}

function Tracker() {
  const { projects, add, update, remove, importRows, replaceAll } = useProjects()
  const { toast, show: showToast } = useToast()

  // UI state
  const [view,   setView]   = useState('kanban')
  const [modal,  setModal]  = useState(null)   // 'add' | 'edit' | 'upload' | 'config'
  const [editId, setEditId] = useState(null)
  const [syncing, setSyncing] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [zone,   setZone]   = useState('')
  const [team,   setTeam]   = useState('')

  // Derived
  const zones = useMemo(() => [...new Set(projects.map(p => p.zone).filter(Boolean))].sort(), [projects])
  const teams = useMemo(() => [...new Set(projects.map(p => p.teamName).filter(Boolean))].sort(), [projects])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return projects.filter(p => {
      const mq = !q || (p.siteName || '').toLowerCase().includes(q) || (p.siteId || '').toLowerCase().includes(q)
      const mz = !zone || p.zone === zone
      const mt = !team || p.teamName === team
      return mq && mz && mt
    })
  }, [projects, search, zone, team])

  // Handlers
  function openAdd()      { setEditId(null); setModal('add') }
  function openEdit(id)   { setEditId(id);   setModal('edit') }
  function closeModal()   { setModal(null);  setEditId(null) }

  function handleSave(p) {
    if (editId) { update(editId, p); showToast('✓ Site updated') }
    else        { add(p);           showToast('✓ Site added') }
    closeModal()
  }

  function handleDelete(id) {
    if (!confirm('Delete this site?')) return
    remove(id)
    showToast('Site deleted')
    closeModal()
  }

  function handleImport(rows) {
    const n = importRows(rows)
    showToast(`✓ ${n} sites imported`)
  }

  async function handleSync() {
    const cfg = loadConfig()
    if (!cfg.url) { showToast('⚠ Set Sheet URL in ⚙ Config first', 'error'); return }
    setSyncing(true)
    try {
      // First push local data
      await pushToSheets(cfg.url, cfg.tab || 'MTNH_Projects', projects)
      // Then pull latest from sheet
      try {
        const rows = await fetchFromSheets(cfg.url, cfg.tab || 'MTNH_Projects')
        if (rows.length > 0) {
          // Merge: sheet data as source of truth for fields, keep local _id mapping
          showToast(`✓ Synced ${projects.length} sites to Google Sheets`)
        }
      } catch {
        showToast(`✓ Pushed ${projects.length} sites to Google Sheets`)
      }
    } catch (err) {
      showToast('⚠ Sync failed — check your Apps Script URL', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const editProject = editId ? projects.find(p => p._id === editId) : null

  return (
    <>
      <Header
        onAdd={openAdd}
        onUpload={() => setModal('upload')}
        onConfig={() => setModal('config')}
        onSync={handleSync}
        syncing={syncing}
      />

      <StatsBar projects={filtered} />

      <Toolbar
        search={search} onSearch={setSearch}
        zone={zone}     onZone={setZone}
        team={team}     onTeam={setTeam}
        zones={zones}   teams={teams}
        view={view}     onView={setView}
      />

      {view === 'kanban' && <KanbanBoard projects={filtered} onOpen={openEdit} />}
      {view === 'list'   && <ListView   projects={filtered} onOpen={openEdit} />}
      {view === 'field'  && (
        <FieldView
          projects={filtered}
          onUpdate={update}
          onFullEdit={id => { openEdit(id) }}
        />
      )}

      {(modal === 'add' || modal === 'edit') && (
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
          <ConfigModal onClose={closeModal} />
        </Overlay>
      )}

      <Toast toast={toast} />
    </>
  )
}
