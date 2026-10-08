import { Fragment, useMemo, useState } from 'react'
import { useApp } from './store'
import { useWarehouse } from './useWarehouse'
import TxnModal from './TxnModal'

// ─────────────────────────────────────────────────────────────────
// WAREHOUSE
//
// Three views on the same movements: what we hold, what moved, and
// where each individual unit is.
//
// The vendor bar narrows movements and serials, because those carry a
// vendor. It cannot narrow stock — a module in the rack is a module in
// the rack, whoever it arrived from.
// ─────────────────────────────────────────────────────────────────

export default function Warehouse({ sites = [] }) {
  const { vendor } = useApp()
  const wh = useWarehouse()
  const [tab, setTab] = useState('stock')
  const [entry, setEntry] = useState(null)   // 'inward' | 'outward'
  const [q, setQ] = useState('')

  const scoped = vendor !== 'All' && vendor !== 'Unassigned'

  if (wh.loading) return <div className="mut sm">Loading the warehouse…</div>

  if (wh.error) {
    return (
      <div className="note badN">
        <b>Warehouse didn't load.</b> {wh.error}
        <div className="sm" style={{ marginTop: 6 }}>
          If it says a table is missing, <code>warehouse_schema.sql</code> hasn't run.
        </div>
      </div>
    )
  }

  const txns = scoped ? wh.txns.filter(t => t.vendor_name === vendor) : wh.txns
  const serials = scoped
    ? wh.serials.filter(s => s.inward_vendor === vendor || s.outward_to === vendor)
    : wh.serials

  const inStock = wh.serials.filter(s => s.status === 'in_stock').length
  const lowItems = wh.stock.filter(s =>
    s.low_stock_at != null && Number(s.balance) <= Number(s.low_stock_at)).length

  return (
    <>
      <div className="tiles">
        <Tile k="Item types" v={wh.stock.length} />
        <Tile k="Units in stock" v={inStock} />
        <Tile k="Low stock" v={lowItems} alert={lowItems > 0} />
        <Tile k="Movements" v={txns.length} />
      </div>

      <div className="row wrap" style={{ marginBottom: 14 }}>
        <div className="nav">
          <button className={tab === 'stock'   ? 'on' : ''} onClick={() => setTab('stock')}>Stock</button>
          <button className={tab === 'txns'    ? 'on' : ''} onClick={() => setTab('txns')}>Movements</button>
          <button className={tab === 'serials' ? 'on' : ''} onClick={() => setTab('serials')}>Serial numbers</button>
        </div>

        <div style={{ width: 200 }}>
          <input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
        </div>

        <div className="right row">
          <button className="ok" onClick={() => setEntry('inward')}>Material in</button>
          <button onClick={() => setEntry('outward')}>Material out</button>
        </div>
      </div>

      {scoped && tab === 'stock' && (
        <div className="note info">
          Stock isn't split by vendor — a module in the rack is a module in the
          rack. The vendor bar narrows Movements and Serial numbers.
        </div>
      )}

      {tab === 'stock'   && <Stock rows={wh.stock} q={q} />}
      {tab === 'txns'    && <Txns rows={txns} lines={wh.lines} q={q} />}
      {tab === 'serials' && <Serials rows={serials} q={q} />}

      {entry && (
        <TxnModal
          type={entry}
          items={wh.items.filter(i => i.active !== false)}
          sites={sites}
          createTxn={wh.createTxn}
          onClose={() => setEntry(null)}
        />
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

// ── stock ────────────────────────────────────────────────────────

function Stock({ rows, q }) {
  const shown = useMemo(() => {
    if (!q.trim()) return rows
    const t = q.trim().toLowerCase()
    return rows.filter(r => [r.name, r.code, r.category].some(v =>
      String(v || '').toLowerCase().includes(t)))
  }, [rows, q])

  const groups = useMemo(() => {
    const g = new Map()
    for (const r of shown) {
      const k = r.category || 'Other'
      if (!g.has(k)) g.set(k, [])
      g.get(k).push(r)
    }
    return [...g.entries()]
  }, [shown])

  if (!shown.length) return <div className="panel center mut">Nothing matches.</div>

  return groups.map(([cat, items]) => (
    <div key={cat} style={{ marginBottom: 18 }}>
      <h3 style={{ marginBottom: 8 }}>{cat}</h3>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Item</th><th>Code</th><th>In</th><th>Out</th>
              <th>Balance</th><th>Metres</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(r => {
              const low = r.low_stock_at != null && Number(r.balance) <= Number(r.low_stock_at)
              return (
                <tr key={r.item_id}>
                  <td><b>{r.name}</b></td>
                  <td className="mono sm">{r.code}</td>
                  <td className="sm mut">{num(r.total_in)}</td>
                  <td className="sm mut">{num(r.total_out)}</td>
                  <td className="mono b" style={low ? { color: 'var(--red)' } : undefined}>
                    {num(r.balance)} <span className="xs mut">{r.unit}</span>
                  </td>
                  <td className="sm mut">{r.has_length ? num(r.balance_mtr) : '—'}</td>
                  <td>
                    {low
                      ? <span className="tag bad">low</span>
                      : r.has_serial ? <span className="tag">serialised</span> : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  ))
}

// ── movements ────────────────────────────────────────────────────

function Txns({ rows, lines, q }) {
  const [open, setOpen] = useState(null)

  const linesOf = useMemo(() => {
    const m = new Map()
    for (const l of lines) {
      if (!m.has(l.txn_id)) m.set(l.txn_id, [])
      m.get(l.txn_id).push(l)
    }
    return m
  }, [lines])

  const shown = useMemo(() => {
    if (!q.trim()) return rows
    const t = q.trim().toLowerCase()
    return rows.filter(r =>
      [r.dc_number, r.sreq_number, r.vendor_name, r.vehicle, r.handled_by,
       (r.site_ids || []).join(' ')]
        .some(v => String(v || '').toLowerCase().includes(t)))
  }, [rows, q])

  if (!shown.length) return <div className="panel center mut">No movements yet.</div>

  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Direction</th><th>Vendor</th><th>Sites</th>
            <th>DC</th><th>Items</th><th>By</th>
          </tr>
        </thead>
        <tbody>
          {shown.map(t => (
            <Fragment key={t.id}>
              <tr onClick={() => setOpen(open === t.id ? null : t.id)}
                  style={{ cursor: 'pointer' }}>
                <td className="sm">{t.txn_date}</td>
                <td>
                  <span className={`tag ${t.txn_type === 'inward' ? 'good' : 'warn'}`}>
                    {t.txn_type === 'inward' ? 'in' : 'out'}
                  </span>
                </td>
                <td className="sm">{t.vendor_name || '—'}</td>
                <td className="mono sm">{(t.site_ids || []).join(', ') || '—'}</td>
                <td className="mono sm">{t.dc_number || '—'}</td>
                <td className="sm">{(linesOf.get(t.id) || []).length}</td>
                <td className="sm">{t.handled_by || '—'}</td>
              </tr>
              {open === t.id && (
                <tr>
                  <td colSpan={7} style={{ background: '#fcfcfd' }}>
                    {(linesOf.get(t.id) || []).map(l => (
                      <div className="row sm" key={l.id} style={{ padding: '3px 0' }}>
                        <span className="mono" style={{ width: 110 }}>{l.item_code}</span>
                        <span className="grow">{l.item_name}</span>
                        <span className="b">{num(l.quantity)}</span>
                        {l.length_each && <span className="mut">× {num(l.length_each)} m</span>}
                        {l.condition && <span className="tag">{l.condition}</span>}
                      </div>
                    ))}
                    {t.remarks && <div className="sm mut" style={{ marginTop: 6 }}>{t.remarks}</div>}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── serials ──────────────────────────────────────────────────────

function Serials({ rows, q }) {
  const shown = useMemo(() => {
    if (!q.trim()) return rows.slice(0, 500)
    const t = q.trim().toLowerCase()
    return rows.filter(r => [r.serial_no, r.item_code, r.site_id, r.outward_to]
      .some(v => String(v || '').toLowerCase().includes(t))).slice(0, 500)
  }, [rows, q])

  if (!shown.length) return <div className="panel center mut">No serials recorded yet.</div>

  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>Serial</th><th>Item</th><th>Status</th><th>Condition</th>
            <th>In</th><th>Out</th><th>Site</th>
          </tr>
        </thead>
        <tbody>
          {shown.map(s => (
            <tr key={s.id}>
              <td className="mono b">{s.serial_no}</td>
              <td className="mono sm">{s.item_code}</td>
              <td>
                <span className={`tag ${s.status === 'in_stock' ? 'good' : 'warn'}`}>
                  {s.status === 'in_stock' ? 'in stock' : s.status}
                </span>
              </td>
              <td className="sm">{s.condition || '—'}</td>
              <td className="sm mut">{s.inward_date || '—'}{s.inward_vendor ? ` · ${s.inward_vendor}` : ''}</td>
              <td className="sm mut">{s.outward_date || '—'}{s.outward_to ? ` · ${s.outward_to}` : ''}</td>
              <td className="mono sm">{s.site_id || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function num(v) {
  if (v == null || v === '') return '0'
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.00$/, '')
}
