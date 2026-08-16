import { useState, useMemo } from 'react'
import { useWarehouse } from '../utils/useWarehouse'
import TxnModal from './TxnModal'
import Overlay from './Overlay'
import styles from './Warehouse.module.css'

const CAT_META = {
  module:  { label: 'Module',      cls: 'cMod' },
  antenna: { label: 'Antenna',     cls: 'cAnt' },
  cable:   { label: 'Cable',       cls: 'cCab' },
  other:   { label: 'Other',       cls: 'cOth' },
}

function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return isNaN(dt) ? d : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function Warehouse({ onBack }) {
  const wh = useWarehouse()
  const [tab, setTab]     = useState('stock')
  const [modal, setModal] = useState(null)
  const [search, setSearch] = useState('')
  const [catF, setCatF]   = useState('')
  const [venF, setVenF]   = useState('')

  const stats = useMemo(() => {
    const now = Date.now(), d30 = 30 * 86400000
    const recent = wh.txns.filter(t => now - new Date(t.txn_date).getTime() < d30)
    return {
      totalItems: wh.stock.reduce((s, r) => s + Math.max(0, Number(r.balance)), 0),
      inward:     recent.filter(t => t.txn_type === 'inward').length,
      outward:    recent.filter(t => t.txn_type === 'outward').length,
      low:        wh.stock.filter(r => Number(r.balance) <= Number(r.low_stock_at)).length,
      serials:    wh.serials.filter(s => s.status === 'in_stock').length,
    }
  }, [wh.stock, wh.txns, wh.serials])

  const grouped = useMemo(() => {
    const g = {}
    wh.stock.forEach(r => {
      if (catF && r.category !== catF) return
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return
      ;(g[r.category] = g[r.category] || []).push(r)
    })
    return g
  }, [wh.stock, catF, search])

  const filteredTxns = useMemo(() => wh.txns.filter(t => {
    if (venF && t.vendor_name !== venF) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (t.vendor_name || '').toLowerCase().includes(q)
      || (t.dc_number || '').toLowerCase().includes(q)
      || (t.sreq_number || '').toLowerCase().includes(q)
      || (t.site_ids || []).some(s => s.toLowerCase().includes(q))
  }), [wh.txns, venF, search])

  const filteredSerials = useMemo(() => wh.serials.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.serial_no.toLowerCase().includes(q)
      || s.item_code.toLowerCase().includes(q)
      || (s.site_id || '').toLowerCase().includes(q)
  }), [wh.serials, search])

  if (wh.loading) return <div className={styles.loading}>Loading warehouse…</div>

  return (
    <>
      <header className={styles.header}>
        <div className={styles.hleft}>
          {onBack && <button className={styles.btn} onClick={onBack}>← Tracker</button>}
          <div className={styles.logo}>MT</div>
          <div className={styles.brand}>MTNH Warehouse <span>— Inward / Outward</span></div>
        </div>
        <div className={styles.hact}>
          <button className={`${styles.btn} ${styles.btnOut}`} onClick={() => setModal('outward')}>↑ Outward</button>
          <button className={`${styles.btn} ${styles.btnIn}`} onClick={() => setModal('inward')}>↓ Inward</button>
        </div>
      </header>

      <div className={styles.stats}>
        <Stat n={stats.totalItems} l="Items in Stock" c="blue" />
        <Stat n={stats.inward}     l="Inward (30d)"   c="green" />
        <Stat n={stats.outward}    l="Outward (30d)"  c="orange" />
        <Stat n={stats.low}        l="Low Stock"      c="red" />
        <Stat n={stats.serials}    l="Serials Held"   c="purple" />
      </div>

      <div className={styles.toolbar}>
        <input className={styles.search} placeholder="Search site, vendor, serial, DC…" value={search} onChange={e => setSearch(e.target.value)} />
        {tab === 'stock' && (
          <select className={styles.sel} value={catF} onChange={e => setCatF(e.target.value)}>
            <option value="">All Categories</option>
            {Object.entries(CAT_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        )}
        {tab === 'log' && (
          <select className={styles.sel} value={venF} onChange={e => setVenF(e.target.value)}>
            <option value="">All Vendors</option>
            {wh.vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
          </select>
        )}
        <div className={styles.spacer} />
        <div className={styles.vtabs}>
          {[['stock', 'Stock'], ['log', 'Transactions'], ['serial', 'Serials']].map(([id, label]) => (
            <button key={id} className={`${styles.vtab} ${tab === id ? styles.vtabOn : ''}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      </div>

      <div className={styles.wrap}>
        {tab === 'stock' && (
          <div className={styles.stockgrid}>
            {Object.entries(grouped).map(([category, rows]) => (
              <div key={category} className={`${styles.catcard} ${styles[CAT_META[category]?.cls || '']}`}>
                <div className={styles.cathdr}>
                  <span>{CAT_META[category]?.label || category}</span>
                  <span>{rows.length} types</span>
                </div>
                <div className={styles.catbody}>
                  {rows.map(r => {
                    const bal = Number(r.balance)
                    const cls = bal <= 0 ? styles.zero : bal <= Number(r.low_stock_at) ? styles.low : styles.ok
                    return (
                      <div key={r.item_id} className={styles.itemrow}>
                        <span className={styles.iname}>
                          {r.name}
                          {r.unit === 'mtr' && <span className={styles.iunit}>mtr</span>}
                        </span>
                        <span className={`${styles.iqty} ${cls}`}>
                          {bal.toLocaleString('en-IN')}
                          {r.has_length && Number(r.balance_mtr) > 0 && (
                            <span className={styles.subqty}>{Number(r.balance_mtr).toFixed(0)}m</span>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            {Object.keys(grouped).length === 0 && <div className={styles.empty}>No items match</div>}
          </div>
        )}

        {tab === 'log' && (
          <table className={styles.table}>
            <thead><tr>
              <th>Date</th><th>Type</th><th>Vendor / To</th><th>Sites</th><th>Items</th><th>DC / SREQ</th><th>By</th><th></th>
            </tr></thead>
            <tbody>
              {filteredTxns.length === 0 && <tr><td colSpan={8} className={styles.emptyCell}>No transactions yet</td></tr>}
              {filteredTxns.map(t => (
                <tr key={t.id}>
                  <td className={styles.mono}>{fmtDate(t.txn_date)}</td>
                  <td><span className={t.txn_type === 'inward' ? styles.pIn : styles.pOut}>
                    {t.txn_type === 'inward' ? '↓ Inward' : '↑ Outward'}
                  </span></td>
                  <td>{t.vendor_name || '—'}</td>
                  <td>
                    <div className={styles.sitechips}>
                      {(t.site_ids || []).slice(0, 2).map(s => <span key={s} className={styles.chip}>{s}</span>)}
                      {(t.site_ids || []).length > 2 && <span className={styles.chip}>+{t.site_ids.length - 2}</span>}
                      {(t.site_ids || []).length === 0 && '—'}
                    </div>
                  </td>
                  <td className={styles.itemsCell}>
                    {(t.wh_txn_lines || []).map(l => `${l.item_name} ×${l.quantity}${l.length_each ? `@${l.length_each}m` : ''}`).join(' · ') || '—'}
                  </td>
                  <td className={styles.mono}>{t.dc_number || t.sreq_number || '—'}</td>
                  <td>{t.handled_by || '—'}</td>
                  <td>
                    <button className={styles.delBtn} onClick={async () => {
                      if (confirm('Delete this entry? Stock will be adjusted back.')) {
                        try { await wh.deleteTxn(t.id) } catch (e) { alert('Delete failed: ' + e.message) }
                      }
                    }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'serial' && (
          <table className={styles.table}>
            <thead><tr>
              <th>Serial No</th><th>Item</th><th>Status</th><th>Site ID</th><th>Inward</th><th>Outward</th><th>Vendor</th>
            </tr></thead>
            <tbody>
              {filteredSerials.length === 0 && <tr><td colSpan={7} className={styles.emptyCell}>No serials tracked yet</td></tr>}
              {filteredSerials.map(s => (
                <tr key={s.id}>
                  <td className={styles.mono}>{s.serial_no}</td>
                  <td>{s.item_code}</td>
                  <td><span className={s.status === 'in_stock' ? styles.pIn : styles.pOut}>
                    {s.status === 'in_stock' ? 'In Stock' : 'Dispatched'}
                  </span></td>
                  <td className={styles.mono}>{s.site_id || '—'}</td>
                  <td className={styles.mono}>{fmtDate(s.inward_date)}</td>
                  <td className={styles.mono}>{fmtDate(s.outward_date)}</td>
                  <td>{s.inward_vendor || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Overlay onClose={() => setModal(null)}>
          <TxnModal
            type={modal}
            items={wh.items}
            vendors={wh.vendors}
            availableSerials={wh.availableSerials}
            getBalance={wh.getBalance}
            onSave={wh.saveTxn}
            onClose={() => setModal(null)}
          />
        </Overlay>
      )}
    </>
  )
}

function Stat({ n, l, c }) {
  return (
    <div className={styles.stat}>
      <div className={`${styles.snum} ${styles[c]}`}>{n.toLocaleString('en-IN')}</div>
      <div className={styles.slbl}>{l}</div>
    </div>
  )
}
