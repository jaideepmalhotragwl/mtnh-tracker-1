import { lazy, Suspense, useMemo, useState } from 'react'
import { STAGES, stageByKey } from './constants'
import { stageDone, pendingStage, progressPct, siteIssues, isYes } from './stageLogic'
import { useApp } from './store'

// The Excel library is two thirds of the whole app. Loading it only when
// somebody actually imports keeps the first open fast on phone data.
const ImportSheet = lazy(() => import('./ImportSheet'))

export default function Tracker({ sites, evidence, loading, error, onOpen, importRows, reload }) {
  const [mode, setMode]   = useState('board')
  const [q, setQ]         = useState('')
  const [onlyBad, setBad] = useState(false)
  const [importing, setImporting] = useState(false)
  const { vendor } = useApp()

  const rows = useMemo(() => {
    let r = sites
    if (q.trim()) {
      const t = q.trim().toLowerCase()
      r = r.filter(s =>
        [s.site_id, s.site_name, s.city, s.district, s.team_name, s.zone]
          .some(v => String(v || '').toLowerCase().includes(t)))
    }
    if (onlyBad) r = r.filter(s => siteIssues(s, evidence[s.site_id]).length > 0)
    return r
  }, [sites, q, onlyBad, evidence])

  const stats = useMemo(() => {
    let billed = 0, paid = 0, noEv = 0, unlisted = 0
    for (const s of sites) {
      if (stageDone(s, stageByKey.invoice)) billed++
      if (stageDone(s, stageByKey.payment)) paid++
      const ev = evidence[s.site_id]
      if (ev && ev.missing_evidence > 0) noEv++
      if (stageDone(s, stageByKey.work) && !isYes(s.listed_on_ultro)) unlisted++
    }
    return { total: sites.length, billed, paid, noEv, unlisted }
  }, [sites, evidence])

  return (
    <>
      {error && <div className="note badN">{error}</div>}

      <div className="tiles">
        <Tile k="Sites" v={stats.total} />
        <Tile k="Invoiced" v={stats.billed} />
        <Tile k="Paid" v={stats.paid} />
        <Tile k="No evidence" v={stats.noEv} alert={stats.noEv > 0} />
        <Tile k="Not on Ultro" v={stats.unlisted} alert={stats.unlisted > 0} />
      </div>

      <div className="row wrap" style={{ marginBottom: 14 }}>
        <div className="nav">
          <button className={mode === 'board' ? 'on' : ''} onClick={() => setMode('board')}>Board</button>
          <button className={mode === 'list'  ? 'on' : ''} onClick={() => setMode('list')}>List</button>
          <button className={mode === 'field' ? 'on' : ''} onClick={() => setMode('field')}>Field</button>
        </div>

        <div style={{ width: 220 }}>
          <input placeholder="Site ID, name, city, team…" value={q} onChange={e => setQ(e.target.value)} />
        </div>

        <label className="chk sm" style={{ margin: 0 }}>
          <input type="checkbox" checked={onlyBad} onChange={e => setBad(e.target.checked)} />
          Needs attention
        </label>

        <div className="right row">
          <button onClick={() => setImporting(true)}>Import Excel</button>
          <button onClick={() => exportCsv(rows)}>Export</button>
          <button className="pri" onClick={() => onOpen({ vendor: vendor === 'All' ? '' : vendor })}>
            New site
          </button>
        </div>
      </div>

      {loading && <div className="mut sm">Loading…</div>}

      {!loading && rows.length === 0 && (
        <div className="panel center mut">
          Nothing here{q ? ' for that search' : vendor !== 'All' ? ` under ${vendor}` : ''}.
        </div>
      )}

      {!loading && rows.length > 0 && mode === 'board' && <Board rows={rows} evidence={evidence} onOpen={onOpen} />}
      {!loading && rows.length > 0 && mode === 'list'  && <ListView rows={rows} evidence={evidence} onOpen={onOpen} />}
      {!loading && rows.length > 0 && mode === 'field' && <FieldView rows={rows} evidence={evidence} onOpen={onOpen} />}

      {importing && (
        <Suspense fallback={<div className="scrim"><div className="modal narrow"><div className="modal-b mut">Loading the Excel reader…</div></div></div>}>
          <ImportSheet
            onClose={() => setImporting(false)}
            importRows={importRows}
            reload={reload}
          />
        </Suspense>
      )}
    </>
  )
}

function Tile({ k, v, alert }) {
  return (
    <div className={`tile ${alert ? 'alert' : ''}`}>
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  )
}

// ── board ────────────────────────────────────────────────────────

function Board({ rows, evidence, onOpen }) {
  const lanes = useMemo(() => {
    const m = Object.fromEntries(STAGES.map(s => [s.key, []]))
    for (const s of rows) m[pendingStage(s).key].push(s)
    return m
  }, [rows])

  return (
    <div className="board">
      {STAGES.map(st => (
        <div className="lane" key={st.key}>
          <div className="lane-h">
            <span className="dot" style={{ background: st.colour }} />
            <span className="t">{st.label}</span>
            <span className="c">{lanes[st.key].length}</span>
          </div>
          <div className="lane-body">
            {lanes[st.key].length === 0
              ? <div className="lane-empty">—</div>
              : lanes[st.key].map(s => (
                  <SiteCard key={s.id} site={s} ev={evidence[s.site_id]} onOpen={onOpen} />
                ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function SiteCard({ site, ev, onOpen }) {
  const issues = siteIssues(site, ev)
  const pct = progressPct(site)

  // What a card says about evidence is the point of the redesign: a
  // ticked stage with no file behind it now shows up in red instead of
  // looking identical to a finished one.
  const stagesWithFiles = STAGES.filter(s => s.photoStage && stageDone(site, s))
  const fileLines = stagesWithFiles.map(s => {
    const n = fileCount(ev, s.photoStage)
    return { stage: s, n }
  })
  const firstMissing = fileLines.find(f => f.n === 0)
  const firstHas     = fileLines.find(f => f.n > 0)

  return (
    <button className="sc" onClick={() => onOpen(site)}>
      <div className="id">{site.site_id}</div>
      {site.site_name && <div className="nm trunc">{site.site_name}</div>}

      <div className="meta">
        {site.vendor && <span className="tag v">{site.vendor}</span>}
        {site.city && <span className="tag">{site.city}</span>}
        {site.team_name && <span className="tag">{site.team_name}</span>}
      </div>

      {firstMissing
        ? <div className="ev no">📷 {firstMissing.stage.short} marked done, no files</div>
        : firstHas
          ? <div className="ev ok">📷 {firstHas.n} {firstHas.stage.short.toLowerCase()} file{firstHas.n > 1 ? 's' : ''}</div>
          : null}

      {issues.filter(i => i.level === 'alert').slice(0, 1).map((i, k) => (
        <div className="meta" key={k}><span className="tag bad">{i.text}</span></div>
      ))}

      <div className="bar"><i style={{ width: `${pct}%` }} /></div>
    </button>
  )
}

function fileCount(ev, photoStage) {
  if (!ev) return 0
  const map = {
    dismantling: 'dismantle_photos',
    material: 'material_photos',
    packing: 'packing_photos',
    dc_doc: 'dc_files',
    handover: 'handover_photos',
    signed_dc: 'signed_dc_files'
  }
  return Number(ev[map[photoStage]] || 0)
}

// ── list ─────────────────────────────────────────────────────────

function ListView({ rows, evidence, onOpen }) {
  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>Site ID</th><th>Name</th><th>Vendor</th><th>Stage</th>
            <th>City</th><th>Team</th><th>Files</th><th>Flags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(s => {
            const ev = evidence[s.site_id]
            const issues = siteIssues(s, ev)
            return (
              <tr key={s.id} onClick={() => onOpen(s)} style={{ cursor: 'pointer' }}>
                <td className="mono">{s.site_id}</td>
                <td className="trunc" style={{ maxWidth: 200 }}>{s.site_name || '—'}</td>
                <td>{s.vendor ? <span className="tag v">{s.vendor}</span> : <span className="fnt">—</span>}</td>
                <td className="sm">{pendingStage(s).label}</td>
                <td className="sm">{s.city || '—'}</td>
                <td className="sm">{s.team_name || '—'}</td>
                <td className="sm">{totalFiles(ev) || <span className="fnt">0</span>}</td>
                <td>
                  {issues.length === 0
                    ? <span className="tag good">clear</span>
                    : issues.slice(0, 2).map((i, k) =>
                        <span key={k} className={`tag ${i.level === 'alert' ? 'bad' : 'warn'}`}>{i.text}</span>)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function totalFiles(ev) {
  if (!ev) return 0
  return ['dismantle_photos','material_photos','packing_photos','dc_files','handover_photos','signed_dc_files']
    .reduce((n, k) => n + Number(ev[k] || 0), 0)
}

// ── field ────────────────────────────────────────────────────────
// What the team needs standing at a tower: what is left to do here.

function FieldView({ rows, evidence, onOpen }) {
  return (
    <div className="col">
      {rows.slice(0, 120).map(s => {
        const next = pendingStage(s)
        const ev = evidence[s.site_id]
        return (
          <div className="panel" key={s.id} style={{ marginBottom: 0, padding: 12 }}>
            <div className="row wrap">
              <div className="grow">
                <div className="row">
                  <span className="mono b">{s.site_id}</span>
                  {s.vendor && <span className="tag v">{s.vendor}</span>}
                </div>
                <div className="sm mut">{s.site_name || '—'}{s.city ? ` · ${s.city}` : ''}</div>
              </div>
              <div className="sm" style={{ textAlign: 'right' }}>
                <div className="xs fnt">next</div>
                <div className="b">{next.label}</div>
              </div>
              <button className="pri tiny" onClick={() => onOpen(s)}>
                {next.photoStage ? 'Upload' : 'Open'}
              </button>
            </div>
            {ev && ev.missing_evidence > 0 && (
              <div className="ev no" style={{ marginTop: 8 }}>
                📷 {ev.missing_evidence} stage{ev.missing_evidence > 1 ? 's' : ''} marked done with no files
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── export ───────────────────────────────────────────────────────

function exportCsv(rows) {
  if (!rows.length) return
  const cols = Object.keys(rows[0]).filter(c => c !== 'id')
  const esc = v => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `mtnh-sites-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
