import { useState, useMemo } from 'react'
import { APP_PASSWORD } from './supabase'
import { useApp } from './store'
import { useProjects } from './useProjects'
import Tracker from './Tracker'
import SiteForm from './SiteForm'
import TeamRoom from './TeamRoom'
import Gallery from './Gallery'
import Warehouse from './Warehouse'
import Settings from './Settings'
import Bell from './Bell'
import Install from './Install'

// Which sections the vendor bar applies to. Team Room is deliberately
// outside it: the team is seven people and splitting the conversation
// four ways would fragment it.
const VENDOR_SCOPED = new Set(['tracker', 'warehouse'])

export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('mtnh_in') === '1')

  // The home-screen icon has long-press shortcuts — Team Room, Tracker,
  // Warehouse — and each opens with ?go= on the end.
  const [view, setView] = useState(() => {
    const want = new URLSearchParams(location.search).get('go')
    return ['tracker', 'room', 'photos', 'warehouse', 'settings'].includes(want)
      ? want : 'tracker'
  })
  const [editing, setEditing] = useState(null)   // a site row, or {} for a new one

  const app = useApp()
  const projects = useProjects()

  // One list, filtered once, handed to whatever is on screen.
  // This has to sit above the login check: React counts hooks per render,
  // so an early return before a useMemo crashes the app the moment
  // somebody logs in.
  const scoped = useMemo(() => {
    if (app.vendor === 'All') return projects.sites
    if (app.vendor === 'Unassigned') return projects.sites.filter(s => !s.vendor)
    return projects.sites.filter(s => s.vendor === app.vendor)
  }, [projects.sites, app.vendor])

  if (!authed) return <Login onIn={() => { sessionStorage.setItem('mtnh_in', '1'); setAuthed(true) }} />

  return (
    <div className="shell">
      <Install />
      <header className="top">
        <div className="brand">MTNH<span>Tower Network Hub</span></div>

        <nav className="nav">
          <Tab id="tracker"   view={view} set={setView}>Tracker</Tab>
          <Tab id="room"      view={view} set={setView}>Team Room</Tab>
          <Tab id="photos"    view={view} set={setView}>Site Photos</Tab>
          <Tab id="warehouse" view={view} set={setView}>Warehouse</Tab>
          <Tab id="settings"  view={view} set={setView}>Settings</Tab>
        </nav>

        <div className="whoami">
          <Bell onGoToRoom={() => setView('room')} />
          <WhoAmI />
        </div>
      </header>

      {VENDOR_SCOPED.has(view) && <VendorBar sites={projects.sites} />}

      {app.warn && <div style={{ padding: '10px 20px 0' }}><div className="note warnN">{app.warn}</div></div>}

      {view === 'room'
        ? <div className="page full">
            <TeamRoom sites={projects.sites} onOpenSite={setEditing} />
          </div>
        : <div className="page">
            {view === 'tracker'   && <Tracker {...projects} sites={scoped} onOpen={setEditing} />}
            {view === 'photos'    && <Gallery sites={projects.sites} />}
            {view === 'warehouse' && <Warehouse sites={projects.sites} />}
            {view === 'settings'  && <Settings />}
          </div>}

      {editing && (
        <SiteForm
          site={editing}
          onClose={() => setEditing(null)}
          onSave={projects.saveSite}
          onDelete={projects.deleteSite}
        />
      )}
    </div>
  )
}

function Tab({ id, view, set, children }) {
  return (
    <button className={view === id ? 'on' : ''} onClick={() => set(id)}>{children}</button>
  )
}

// Who is using the portal right now. Everything written — a message, a
// photo, a payment — is stamped with this, so "who did this" is always
// answerable.
function WhoAmI() {
  const { me, pickMe, activePeople } = useApp()
  const person = activePeople.find(p => p.name === me)

  return (
    <>
      {person && (
        <div className="av" style={{ background: person.colour || '#1a56db' }}>
          {person.initials || person.name[0]}
        </div>
      )}
      <select value={me} onChange={e => pickMe(e.target.value)}>
        <option value="">Who are you?</option>
        {activePeople.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
      </select>
    </>
  )
}

function VendorBar({ sites }) {
  const { vendor, setVendor, activeVendors } = useApp()

  const counts = useMemo(() => {
    const c = { All: sites.length, Unassigned: 0 }
    for (const s of sites) {
      if (!s.vendor) c.Unassigned++
      else c[s.vendor] = (c[s.vendor] || 0) + 1
    }
    return c
  }, [sites])

  const tabs = ['All', ...activeVendors.map(v => v.name)]
  if (counts.Unassigned > 0) tabs.push('Unassigned')

  return (
    <div className="vbar">
      {tabs.map(t => (
        <button key={t} className={`vt ${vendor === t ? 'on' : ''}`} onClick={() => setVendor(t)}>
          <b>{t}</b><span className="n">{counts[t] || 0}</span>
        </button>
      ))}
      <span className="xs fnt" style={{ marginLeft: 6 }}>
        scopes the tracker and warehouse
      </span>
    </div>
  )
}

function Login({ onIn }) {
  const [pw, setPw] = useState('')
  const [bad, setBad] = useState(false)

  function go(e) {
    e.preventDefault()
    if (pw === APP_PASSWORD) onIn()
    else { setBad(true); setPw('') }
  }

  return (
    <div className="login">
      <form className="box" onSubmit={go}>
        <div className="brand" style={{ marginBottom: 4 }}>MTNH</div>
        <div className="sm mut" style={{ marginBottom: 18 }}>Tower Network Hub · internal</div>
        <label>Password</label>
        <input type="password" value={pw} autoFocus
               onChange={e => { setPw(e.target.value); setBad(false) }} />
        {bad && <div className="sm" style={{ color: 'var(--red)', marginTop: 6 }}>Not that one.</div>}
        <button className="pri" style={{ width: '100%', marginTop: 14 }} type="submit">Open</button>
      </form>
    </div>
  )
}
