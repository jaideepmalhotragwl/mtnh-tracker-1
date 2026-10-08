import { useState } from 'react'
import { supabase, errLine } from './supabase'
import { useApp } from './store'
import { useToast } from './Toast'

// ─────────────────────────────────────────────────────────────────
// SETTINGS  (R6)
//
// Archive, never delete. An archived vendor keeps every site it ever
// gave us and simply stops appearing in dropdowns. Deleting would take
// the history with it.
//
// Only admins can archive. Right now that is Jaideep.
// ─────────────────────────────────────────────────────────────────

export default function Settings() {
  const [tab, setTab] = useState('people')

  return (
    <>
      <div className="nav" style={{ marginBottom: 14 }}>
        <button className={tab === 'people'  ? 'on' : ''} onClick={() => setTab('people')}>People</button>
        <button className={tab === 'vendors' ? 'on' : ''} onClick={() => setTab('vendors')}>Vendors</button>
        <button className={tab === 'stages'  ? 'on' : ''} onClick={() => setTab('stages')}>Upload slots</button>
      </div>

      {tab === 'people'  && <People />}
      {tab === 'vendors' && <Vendors />}
      {tab === 'stages'  && <Stages />}
    </>
  )
}

function useAdminGate() {
  const { isAdmin, me } = useApp()
  if (!me) return { ok: false, why: 'Pick your name in the top right first.' }
  if (!isAdmin) return { ok: false, why: 'Only admins can change this. Ask Jaideep.' }
  return { ok: true }
}

// ── people ───────────────────────────────────────────────────────

function People() {
  const { people, reloadLists } = useApp()
  const toast = useToast()
  const gate = useAdminGate()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', initials: '', phone: '', colour: '#1a56db' })

  async function add() {
    if (!form.name.trim()) { toast('Name?', 'bad'); return }
    const { error } = await supabase.from('room_users').insert({
      name: form.name.trim(),
      initials: (form.initials || form.name.trim()[0]).toUpperCase(),
      phone: form.phone || null,
      colour: form.colour
    })
    if (error) { toast(errLine(error), 'bad'); return }
    toast(`${form.name} added.`, 'good')
    setForm({ name: '', initials: '', phone: '', colour: '#1a56db' })
    setAdding(false)
    reloadLists()
  }

  async function flip(person, field) {
    const { error } = await supabase.from('room_users')
      .update({ [field]: !person[field] }).eq('id', person.id)
    if (error) { toast(errLine(error), 'bad'); return }
    reloadLists()
  }

  return (
    <>
      {!gate.ok && <div className="note warnN">{gate.why}</div>}

      <div className="row" style={{ marginBottom: 12 }}>
        <h2>People</h2>
        <button className="pri right" disabled={!gate.ok} onClick={() => setAdding(a => !a)}>
          {adding ? 'Cancel' : 'Add a person'}
        </button>
      </div>

      {adding && (
        <div className="panel">
          <div className="grid3">
            <div><label>Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label>Initials</label>
              <input maxLength={2} value={form.initials} onChange={e => setForm({ ...form, initials: e.target.value })} /></div>
            <div><label>Phone</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label>Colour</label>
              <input type="color" value={form.colour} onChange={e => setForm({ ...form, colour: e.target.value })} /></div>
          </div>
          <button className="pri" style={{ marginTop: 12 }} onClick={add}>Add</button>
        </div>
      )}

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th></th><th>Name</th><th>Phone</th>
              <th>Can request payment</th><th>Can pay</th><th>Admin</th><th></th>
            </tr>
          </thead>
          <tbody>
            {people.map(p => (
              <tr key={p.id} className={p.active === false ? 'dim' : ''}>
                <td>
                  <div className="av" style={{ background: p.colour || '#6b7280' }}>
                    {p.initials || p.name[0]}
                  </div>
                </td>
                <td>
                  <b>{p.name}</b>
                  {p.active === false && <span className="tag" style={{ marginLeft: 6 }}>archived</span>}
                </td>
                <td className="sm">{p.phone || '—'}</td>
                <td><Flag on={p.can_request_payment} disabled={!gate.ok} onClick={() => flip(p, 'can_request_payment')} /></td>
                <td><Flag on={p.can_pay} disabled={!gate.ok} onClick={() => flip(p, 'can_pay')} /></td>
                <td><Flag on={p.is_admin} disabled={!gate.ok} onClick={() => flip(p, 'is_admin')} /></td>
                <td>
                  <button className="tiny" disabled={!gate.ok} onClick={() => flip(p, 'active')}>
                    {p.active === false ? 'Restore' : 'Archive'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm mut" style={{ marginTop: 10 }}>
        Archiving keeps everything a person ever did. Their name stops showing
        in the dropdowns, and their old messages, photos and payments stay
        exactly where they are.
      </div>
    </>
  )
}

function Flag({ on, onClick, disabled }) {
  return (
    <button className={`tiny ${on ? 'ok' : ''}`} disabled={disabled} onClick={onClick}>
      {on ? 'yes' : 'no'}
    </button>
  )
}

// ── vendors ──────────────────────────────────────────────────────

function Vendors() {
  const { vendors, reloadLists } = useApp()
  const toast = useToast()
  const gate = useAdminGate()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', aliases: '', gives_work: true, supplies: true, contact: '', phone: '' })

  async function add() {
    if (!form.name.trim()) { toast('Vendor name?', 'bad'); return }
    const aliases = form.aliases.split(',').map(s => s.trim()).filter(Boolean)
    const { error } = await supabase.from('vendors').insert({
      name: form.name.trim(), aliases,
      gives_work: form.gives_work, supplies: form.supplies,
      contact: form.contact || null, phone: form.phone || null,
      sort_order: (vendors.length + 1) * 10
    })
    if (error) { toast(errLine(error), 'bad'); return }
    toast(`${form.name} added.`, 'good')
    setForm({ name: '', aliases: '', gives_work: true, supplies: true, contact: '', phone: '' })
    setAdding(false)
    reloadLists()
  }

  async function flip(v, field) {
    const { error } = await supabase.from('vendors').update({ [field]: !v[field] }).eq('id', v.id)
    if (error) { toast(errLine(error), 'bad'); return }
    reloadLists()
  }

  return (
    <>
      {!gate.ok && <div className="note warnN">{gate.why}</div>}

      <div className="row" style={{ marginBottom: 12 }}>
        <h2>Vendors</h2>
        <button className="pri right" disabled={!gate.ok} onClick={() => setAdding(a => !a)}>
          {adding ? 'Cancel' : 'Add a vendor'}
        </button>
      </div>

      {adding && (
        <div className="panel">
          <div className="grid2">
            <div><label>Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label>Other names they go by (comma separated)</label>
              <input placeholder="Mobilecom" value={form.aliases}
                     onChange={e => setForm({ ...form, aliases: e.target.value })} /></div>
            <div><label>Contact</label>
              <input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></div>
            <div><label>Phone</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <label className="chk sm">
              <input type="checkbox" checked={form.gives_work}
                     onChange={e => setForm({ ...form, gives_work: e.target.checked })} />
              Gives us work
            </label>
            <label className="chk sm">
              <input type="checkbox" checked={form.supplies}
                     onChange={e => setForm({ ...form, supplies: e.target.checked })} />
              Supplies material
            </label>
          </div>
          <button className="pri" style={{ marginTop: 12 }} onClick={add}>Add</button>
        </div>
      )}

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr><th>Vendor</th><th>Also known as</th><th>Contact</th><th>Gives work</th><th>Supplies</th><th></th></tr>
          </thead>
          <tbody>
            {vendors.map(v => (
              <tr key={v.id} className={v.active === false ? 'dim' : ''}>
                <td>
                  <b>{v.name}</b>
                  {v.active === false && <span className="tag" style={{ marginLeft: 6 }}>archived</span>}
                </td>
                <td className="sm mut">
                  {v.aliases?.length ? `also: ${v.aliases.join(', ')}` : '—'}
                </td>
                <td className="sm">{v.contact || '—'}{v.phone ? ` · ${v.phone}` : ''}</td>
                <td><Flag on={v.gives_work} disabled={!gate.ok} onClick={() => flip(v, 'gives_work')} /></td>
                <td><Flag on={v.supplies} disabled={!gate.ok} onClick={() => flip(v, 'supplies')} /></td>
                <td>
                  <button className="tiny" disabled={!gate.ok} onClick={() => flip(v, 'active')}>
                    {v.active === false ? 'Restore' : 'Archive'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm mut" style={{ marginTop: 10 }}>
        An alias means one company never becomes two records. UST and Mobilecom
        are the same company, so an Excel sheet saying "Mobilecom" imports as UST.
      </div>
    </>
  )
}

// ── upload slots ─────────────────────────────────────────────────

function Stages() {
  const { stages, reloadLists } = useApp()
  const toast = useToast()
  const gate = useAdminGate()

  async function flip(s) {
    const { error } = await supabase.from('photo_stages')
      .update({ active: !s.active }).eq('id', s.id)
    if (error) { toast(errLine(error), 'bad'); return }
    reloadLists()
  }

  return (
    <>
      {!gate.ok && <div className="note warnN">{gate.why}</div>}

      <h2 style={{ marginBottom: 12 }}>Upload slots</h2>

      <div className="note info">
        Each row here is an upload slot on the site form and an option in the
        Team Room's stage picker. The last two columns are what gets ticked in
        the tracker when a file lands — which is why an upload from either place
        moves the card the same way.
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Stage</th><th>What it accepts</th><th>Ticks</th>
              <th>Stamps the date</th><th></th>
            </tr>
          </thead>
          <tbody>
            {stages.map(s => (
              <tr key={s.id} className={s.active === false ? 'dim' : ''}>
                <td>
                  <b>{s.label}</b>
                  <div className="xs fnt mono">{s.key} · stage {s.stage_no}</div>
                </td>
                <td className="sm">{s.file_kind === 'pdf' ? 'a PDF' : 'photos'}</td>
                <td className="sm mono">{s.flag_column || '—'}</td>
                <td className="sm mono">{s.date_column || '—'}</td>
                <td>
                  <button className="tiny" disabled={!gate.ok} onClick={() => flip(s)}>
                    {s.active === false ? 'Restore' : 'Archive'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm mut" style={{ marginTop: 10 }}>
        Need a slot that isn't here — site condition before starting, tower
        photos, an SREQ screenshot? Tell me which stage it belongs to and it's
        one row.
      </div>
    </>
  )
}
