import { useMemo, useState } from 'react'
import { useApp } from './store'
import { useToast } from './Toast'
import { suggestSerial } from './useWarehouse'
import Scanner, { scannerAvailable } from './Scanner'
import { useEscape } from './useEscape'

// ─────────────────────────────────────────────────────────────────
// MATERIAL IN / MATERIAL OUT
//
// One form for both directions. The difference is only in wording and
// in what happens to the serial numbers afterwards.
//
// Items that carry serials ask for one box per unit, because a module
// is a specific module — knowing you hold four of them is not the same
// as knowing which four.
// ─────────────────────────────────────────────────────────────────

const CONDITIONS = ['OK', 'Faulty', 'Damaged', 'Unknown']

export default function TxnModal({ type, items, sites, onClose, createTxn }) {
  const { activeVendors, activePeople, me, vendor: selectedVendor } = useApp()
  const toast = useToast()

  const inward = type === 'inward'

  const [head, setHead] = useState({
    txn_date: new Date().toISOString().slice(0, 10),
    vendor_name: selectedVendor !== 'All' && selectedVendor !== 'Unassigned' ? selectedVendor : '',
    dc_number: '', sreq_number: '', vehicle: '',
    handled_by: me || '', remarks: ''
  })
  const [siteIds, setSiteIds] = useState([''])
  const [rows, setRows] = useState([blankRow()])
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)

  useEscape(onClose)

  const itemById = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items])

  function blankRow() {
    return { item_id: '', quantity: '', length_each: '', condition: 'OK', remarks: '', serials: [] }
  }

  const setHeadField = (k, v) => setHead(h => ({ ...h, [k]: v }))

  function setRow(i, patch) {
    setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  // Changing the item or the quantity resizes that row's serial boxes.
  function onItem(i, itemId) {
    const it = itemById[itemId]
    setRow(i, {
      item_id: itemId,
      item_code: it?.code,
      item_name: it?.name,
      serials: it?.has_serial ? resize([], Number(rows[i].quantity) || 0, it.code) : []
    })
  }

  function onQty(i, qty) {
    const r = rows[i]
    const it = itemById[r.item_id]
    setRow(i, {
      quantity: qty,
      serials: it?.has_serial ? resize(r.serials, Number(qty) || 0, it.code) : []
    })
  }

  function resize(current, n, code) {
    const out = current.slice(0, n)
    while (out.length < n) out.push(suggestSerial(code, out.length + 1))
    return out
  }

  // A scan drops into the first serial box that still holds a suggestion
  // or nothing, so the person can scan a whole box of modules without
  // touching the screen between units.
  function onScan(value) {
    setRows(rs => {
      const next = rs.map(r => ({ ...r, serials: [...r.serials] }))
      for (const r of next) {
        const it = itemById[r.item_id]
        if (!it?.has_serial) continue
        const k = r.serials.findIndex(s => !s || s.startsWith('MT-'))
        if (k !== -1) { r.serials[k] = value.toUpperCase(); return next }
      }
      toast('Every serial box is already filled.', 'bad')
      return rs
    })
  }

  async function save() {
    const usable = rows.filter(r => r.item_id && Number(r.quantity) > 0)
    if (!usable.length) { toast('Add an item and a quantity.', 'bad'); return }

    // Without a vendor the movement disappears from every vendor tab —
    // entered, saved, and then invisible. Better to ask for it now.
    if (!head.vendor_name) {
      toast(inward ? 'Who was this received from?' : 'Who is this going to?', 'bad')
      return
    }

    const serialRows = []
    for (const r of usable) {
      const it = itemById[r.item_id]
      if (!it?.has_serial) continue
      const filled = r.serials.filter(s => s && s.trim())
      if (filled.length !== Number(r.quantity)) {
        toast(`${it.name}: ${Number(r.quantity)} units but ${filled.length} serials.`, 'bad')
        return
      }
      for (const s of filled) {
        serialRows.push({
          serial_no: s, item_id: it.id, item_code: it.code,
          condition: r.condition, site_id: null
        })
      }
    }

    setBusy(true)
    try {
      await createTxn({
        header: { ...head, txn_type: type, site_ids: siteIds.filter(Boolean) },
        lines: usable.map(r => ({
          ...r,
          item_code: itemById[r.item_id]?.code,
          item_name: itemById[r.item_id]?.name
        })),
        serials: serialRows
      })
      toast(inward ? 'Material received.' : 'Material issued.', 'good')
      onClose()
    } catch (err) {
      toast(err.message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="scrim" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-h">
          <h2>{inward ? 'Material in' : 'Material out'}</h2>
          <span className="tag">{inward ? 'arriving at MTNH' : 'leaving MTNH'}</span>
          <button className="ghost right" onClick={onClose}>Close</button>
        </div>

        <div className="modal-b">
          <div className="grid3">
            <div>
              <label>Date</label>
              <input type="date" value={head.txn_date}
                     onChange={e => setHeadField('txn_date', e.target.value)} />
            </div>
            <div>
              <label>{inward ? 'Received from' : 'Sent to'}</label>
              <select value={head.vendor_name} onChange={e => setHeadField('vendor_name', e.target.value)}>
                <option value="">—</option>
                {activeVendors.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label>Handled by</label>
              <select value={head.handled_by} onChange={e => setHeadField('handled_by', e.target.value)}>
                <option value="">—</option>
                {activePeople.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label>DC number</label>
              <input value={head.dc_number} onChange={e => setHeadField('dc_number', e.target.value)} />
            </div>
            <div>
              <label>SREQ number</label>
              <input value={head.sreq_number} onChange={e => setHeadField('sreq_number', e.target.value)} />
            </div>
            <div>
              <label>Vehicle</label>
              <input value={head.vehicle} onChange={e => setHeadField('vehicle', e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label>Sites this covers</label>
            {siteIds.map((s, i) => (
              <div className="row" key={i} style={{ marginBottom: 6 }}>
                <input list="wh-sites" className="mono" placeholder="Site ID" value={s}
                       onChange={e => setSiteIds(x => x.map((y, j) => j === i ? e.target.value.toUpperCase() : y))} />
                <button className="ghost tiny" onClick={() => setSiteIds(x => x.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <datalist id="wh-sites">
              {sites.map(s => <option key={s.id} value={s.site_id}>{s.site_name || ''}</option>)}
            </datalist>
            <button className="tiny" onClick={() => setSiteIds(x => [...x, ''])}>+ another site</button>
          </div>

          <div className="row" style={{ marginTop: 18, marginBottom: 8 }}>
            <h3>Items</h3>
            {scannerAvailable() && (
              <button className="tiny right" onClick={() => setScanning(true)}>Scan serials</button>
            )}
          </div>

          {rows.map((r, i) => {
            const it = itemById[r.item_id]
            return (
              <div className="panel" key={i} style={{ padding: 12, marginBottom: 10 }}>
                <div className="grid3">
                  <div style={{ gridColumn: 'span 2' }}>
                    <label>Item</label>
                    <select value={r.item_id} onChange={e => onItem(i, e.target.value)}>
                      <option value="">—</option>
                      {items.map(x => (
                        <option key={x.id} value={x.id}>
                          {x.name}{x.category ? ` · ${x.category}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Quantity{it?.unit ? ` (${it.unit})` : ''}</label>
                    <input type="number" value={r.quantity} onChange={e => onQty(i, e.target.value)} />
                  </div>
                  {it?.has_length && (
                    <div>
                      <label>Length each (m)</label>
                      <input type="number" value={r.length_each}
                             onChange={e => setRow(i, { length_each: e.target.value })} />
                    </div>
                  )}
                  <div>
                    <label>Condition</label>
                    <select value={r.condition} onChange={e => setRow(i, { condition: e.target.value })}>
                      {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Remarks</label>
                    <input value={r.remarks} onChange={e => setRow(i, { remarks: e.target.value })} />
                  </div>
                </div>

                {it?.has_serial && r.serials.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <label>
                      Serial number per unit — {r.serials.length} needed
                      <span className="fnt"> · the suggested code is overwritable</span>
                    </label>
                    <div className="grid3">
                      {r.serials.map((s, k) => (
                        <input key={k} className="mono" value={s}
                               onChange={e => setRow(i, {
                                 serials: r.serials.map((y, m) => m === k ? e.target.value.toUpperCase() : y)
                               })} />
                      ))}
                    </div>
                  </div>
                )}

                {rows.length > 1 && (
                  <button className="ghost tiny" style={{ marginTop: 8 }}
                          onClick={() => setRows(x => x.filter((_, j) => j !== i))}>
                    Remove this item
                  </button>
                )}
              </div>
            )
          })}

          <button className="tiny" onClick={() => setRows(x => [...x, blankRow()])}>+ another item</button>

          <div style={{ marginTop: 14 }}>
            <label>Remarks</label>
            <input value={head.remarks} onChange={e => setHeadField('remarks', e.target.value)} />
          </div>

          <div className="sm mut" style={{ marginTop: 12 }}>
            Stock balances aren't stored anywhere — they're worked out from
            these movements, so they can never disagree with the history.
          </div>
        </div>

        <div className="modal-f">
          <button className="pri" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : inward ? 'Record material in' : 'Record material out'}
          </button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>

      {scanning && <Scanner onRead={onScan} onClose={() => setScanning(false)} />}
    </div>
  )
}
