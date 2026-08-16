import { useState } from 'react'
import styles from './Warehouse.module.css'

const CATS = [
  { id: 'module',  label: 'Module' },
  { id: 'antenna', label: 'Antenna' },
  { id: 'cable',   label: 'Cable' },
  { id: 'other',   label: 'Other' },
]

export default function TxnModal({ type, items, vendors, availableSerials, getBalance, onSave, onClose }) {
  const isIn = type === 'inward'
  const today = new Date().toISOString().slice(0, 10)

  const [hdr, setHdr] = useState({
    txn_type: type,
    txn_date: today,
    vendor_name: vendors[0]?.name || '',
    vendor_id: vendors[0]?.id || '',
    dc_number: '', sreq_number: '', vehicle: '', handled_by: '', remarks: '',
  })
  const [sites, setSites]   = useState([])
  const [siteIn, setSiteIn] = useState('')
  const [cat, setCat]       = useState('module')
  const [lines, setLines]   = useState([])
  const [saving, setSaving] = useState(false)

  const h = (k, v) => setHdr(p => ({ ...p, [k]: v }))

  function pickVendor(name) {
    const v = vendors.find(x => x.name === name)
    setHdr(p => ({ ...p, vendor_name: name, vendor_id: v?.id || '' }))
  }

  function addSite() {
    const v = siteIn.trim().toUpperCase()
    if (!v || sites.includes(v)) { setSiteIn(''); return }
    setSites([...sites, v]); setSiteIn('')
  }

  function toggleItem(item) {
    const exists = lines.find(l => l.item_id === item.id)
    if (exists) {
      setLines(lines.filter(l => l.item_id !== item.id))
    } else {
      setLines([...lines, {
        item_id: item.id, item_code: item.code, item_name: item.name,
        category: item.category, unit: item.unit,
        has_serial: item.has_serial, has_length: item.has_length,
        quantity: '', length_each: '', condition: 'Good', remarks: '',
        serials: item.has_serial ? [''] : [],
      }])
    }
  }

  function upd(idx, k, v) {
    setLines(lines.map((l, i) => {
      if (i !== idx) return l
      const next = { ...l, [k]: v }
      // keep serial slots in sync with quantity
      if (k === 'quantity' && l.has_serial) {
        const n = Math.max(0, parseInt(v) || 0)
        const cur = [...(l.serials || [])]
        while (cur.length < n) cur.push('')
        next.serials = cur.slice(0, n || 1)
      }
      return next
    }))
  }

  function updSerial(idx, si, v) {
    setLines(lines.map((l, i) => {
      if (i !== idx) return l
      const s = [...(l.serials || [])]
      s[si] = v
      return { ...l, serials: s }
    }))
  }

  function addSerialSlot(idx) {
    setLines(lines.map((l, i) => i === idx ? { ...l, serials: [...(l.serials || []), ''] } : l))
  }

  async function handleSave() {
    if (lines.length === 0) { alert('Add at least one item'); return }
    for (const l of lines) {
      if (!l.quantity || Number(l.quantity) <= 0) {
        alert(`Enter a quantity for ${l.item_name}`); return
      }
      if (!isIn) {
        const bal = getBalance(l.item_id)
        if (Number(l.quantity) > bal) {
          if (!confirm(`${l.item_name}: only ${bal} in stock but dispatching ${l.quantity}. Continue?`)) return
        }
      }
    }
    setSaving(true)
    try {
      await onSave({ ...hdr, site_ids: sites }, lines)
      onClose()
    } catch (err) {
      alert('Save failed: ' + (err.message || err))
    } finally { setSaving(false) }
  }

  const catItems = items.filter(i => i.category === cat)

  return (
    <div className={styles.modal}>
      <div className={styles.mhdr}>
        <span className={styles.mtitle}>
          {isIn ? '↓ Inward Entry' : '↑ Outward Entry'}
          <span className={isIn ? styles.tagIn : styles.tagOut}>
            {isIn ? 'Material Received' : 'To Client / Partner Warehouse'}
          </span>
        </span>
        <button className={styles.mclose} onClick={onClose}>✕</button>
      </div>

      <div className={styles.mbody}>
        <div className={styles.sec}>{isIn ? 'Delivery Details' : 'Dispatch Details'}</div>
        <div className={styles.grid}>
          <div className={styles.fg}>
            <label className={styles.lbl}>{isIn ? 'Received Date' : 'Dispatch Date'}</label>
            <input className={styles.input} type="date" value={hdr.txn_date} onChange={e => h('txn_date', e.target.value)} />
          </div>
          <div className={styles.fg}>
            <label className={styles.lbl}>{isIn ? 'Vendor / From' : 'To Warehouse'}</label>
            <select className={styles.input} value={hdr.vendor_name} onChange={e => pickVendor(e.target.value)}>
              {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
            </select>
          </div>
          <div className={styles.fg}>
            <label className={styles.lbl}>DC / Challan No.</label>
            <input className={styles.input} value={hdr.dc_number} onChange={e => h('dc_number', e.target.value)} placeholder="e.g. DC-2026-441" />
          </div>
          {!isIn && (
            <div className={styles.fg}>
              <label className={styles.lbl}>SREQ Number</label>
              <input className={styles.input} value={hdr.sreq_number} onChange={e => h('sreq_number', e.target.value)} placeholder="e.g. SREQ2663680" />
            </div>
          )}
          <div className={styles.fg}>
            <label className={styles.lbl}>{isIn ? 'Received By' : 'Dispatched By'}</label>
            <input className={styles.input} value={hdr.handled_by} onChange={e => h('handled_by', e.target.value)} />
          </div>
          {!isIn && (
            <div className={styles.fg}>
              <label className={styles.lbl}>Vehicle / Transport</label>
              <input className={styles.input} value={hdr.vehicle} onChange={e => h('vehicle', e.target.value)} placeholder="optional" />
            </div>
          )}
        </div>

        <div className={styles.sec}>Site IDs <span className={styles.secHint}>— add one or more</span></div>
        <div className={styles.siteinput}>
          <input
            className={styles.input} style={{ flex: 1 }}
            placeholder="Type site ID and press Enter"
            value={siteIn}
            onChange={e => setSiteIn(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSite() } }}
          />
          <button className={styles.btn} onClick={addSite}>+ Add</button>
        </div>
        {sites.length > 0 && (
          <div className={styles.sitelist}>
            {sites.map(s => (
              <span key={s} className={styles.sitetag}>
                {s} <span className={styles.x} onClick={() => setSites(sites.filter(x => x !== s))}>✕</span>
              </span>
            ))}
          </div>
        )}

        <div className={styles.sec}>Add Items</div>
        <div className={styles.itembar}>
          {CATS.map(c => (
            <button key={c.id} className={`${styles.catbtn} ${cat === c.id ? styles.catOn : ''}`} onClick={() => setCat(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <div className={styles.itemgrid}>
          {catItems.map(item => {
            const added = lines.some(l => l.item_id === item.id)
            const bal = getBalance(item.id)
            return (
              <button key={item.id} className={`${styles.itembtn} ${added ? styles.itemAdded : ''}`} onClick={() => toggleItem(item)}>
                {item.name}
                {!isIn && <span className={styles.balHint}>{bal} in stock</span>}
              </button>
            )
          })}
        </div>

        {lines.length > 0 && (
          <>
            <div className={styles.sec}>
              Items in This Entry <span className={styles.secHint}>— {lines.length} added</span>
            </div>
            {lines.map((l, idx) => {
              const bal = getBalance(l.item_id)
              const over = !isIn && Number(l.quantity) > bal
              const avail = !isIn && l.has_serial ? availableSerials(l.item_id) : []
              return (
                <div key={l.item_id} className={styles.lineitem}>
                  <div className={styles.litop}>
                    <div>
                      <span className={styles.liname}>{l.item_name}</span>
                      <span className={styles.libadge}>
                        {l.has_serial ? 'Serial tracked' : l.has_length ? 'Pieces + length' : l.unit === 'mtr' ? 'Metres' : 'Units'}
                      </span>
                    </div>
                    <button className={styles.lirm} onClick={() => setLines(lines.filter((_, i) => i !== idx))}>✕</button>
                  </div>

                  <div className={l.has_length ? styles.grid4 : styles.grid3}>
                    <div className={styles.fg}>
                      <label className={styles.lbl}>{l.unit === 'mtr' ? 'Length (mtr)' : 'Quantity (pcs)'}</label>
                      <input className={styles.input} value={l.quantity} onChange={e => upd(idx, 'quantity', e.target.value)} placeholder="0" />
                    </div>
                    {l.has_length && (
                      <div className={styles.fg}>
                        <label className={styles.lbl}>Length each (mtr)</label>
                        <input className={styles.input} value={l.length_each} onChange={e => upd(idx, 'length_each', e.target.value)} placeholder="e.g. 3" />
                      </div>
                    )}
                    <div className={styles.fg}>
                      <label className={styles.lbl}>Condition</label>
                      <select className={styles.input} value={l.condition} onChange={e => upd(idx, 'condition', e.target.value)}>
                        <option>Good</option><option>Faulty</option><option>Scrap</option>
                      </select>
                    </div>
                    <div className={styles.fg}>
                      <label className={styles.lbl}>Remarks</label>
                      <input className={styles.input} value={l.remarks} onChange={e => upd(idx, 'remarks', e.target.value)} placeholder="optional" />
                    </div>
                  </div>

                  {l.has_length && l.quantity && l.length_each && (
                    <div className={styles.totalHint}>
                      Total: {l.quantity} pcs × {l.length_each} mtr = <strong>{(Number(l.quantity) * Number(l.length_each)).toFixed(1)} mtr</strong>
                    </div>
                  )}

                  {over && (
                    <div className={styles.stockwarn}>
                      ⚠ Only {bal} in stock — dispatching {l.quantity} will take the balance negative
                    </div>
                  )}

                  {l.has_serial && (
                    <div className={styles.serialbox}>
                      <div className={styles.serialhdr}>
                        {isIn ? `Serial Numbers — ${l.serials.length} slot${l.serials.length !== 1 ? 's' : ''}` : `Select Serials from Stock — ${avail.length} available`}
                      </div>
                      {(l.serials || []).map((sn, si) => (
                        <div key={si} className={styles.serialrow}>
                          {isIn ? (
                            <input className={styles.input} value={sn} onChange={e => updSerial(idx, si, e.target.value)} placeholder={`Serial ${si + 1}`} />
                          ) : (
                            <select className={styles.input} value={sn} onChange={e => updSerial(idx, si, e.target.value)}>
                              <option value="">Select serial…</option>
                              {avail.map(a => <option key={a.id} value={a.serial_no}>{a.serial_no}</option>)}
                            </select>
                          )}
                        </div>
                      ))}
                      <button className={styles.addserial} onClick={() => addSerialSlot(idx)}>+ Add another serial</button>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {lines.length === 0 && (
          <div className={styles.emptyitems}>Pick items above to add them to this entry</div>
        )}

        <div className={styles.sec}>Notes</div>
        <div className={styles.grid}>
          <div className={`${styles.fg} ${styles.full}`}>
            <label className={styles.lbl}>{isIn ? 'Entry Remarks' : 'Dispatch Remarks'}</label>
            <textarea className={styles.textarea} value={hdr.remarks} onChange={e => h('remarks', e.target.value)} placeholder="Any notes…" />
          </div>
        </div>
      </div>

      <div className={styles.mfoot}>
        <button className={styles.btn} onClick={onClose}>Cancel</button>
        <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : isIn ? 'Save Inward Entry' : 'Save Outward Entry'}
        </button>
      </div>
    </div>
  )
}
