import { useCallback, useEffect, useState } from 'react'
import { supabase, errLine } from './supabase'
import { normSiteId } from './useProjects'

// ─────────────────────────────────────────────────────────────────
// WAREHOUSE
//
// wh_stock is a view — balance, total_in and total_out are worked out
// from the transaction lines every time it is read. So nothing here
// ever writes a stock number; it writes movements, and the balance
// follows. A stock figure can't drift from its history.
//
// One thing to know about vendor_id: wh_vendors used to be its own
// table and is now a view over the shared vendors list, so the old ids
// no longer line up. Transactions are written with vendor_name only
// and vendor_id left null, which keeps the old foreign key happy.
// ─────────────────────────────────────────────────────────────────

export function useWarehouse() {
  const [items,   setItems]   = useState([])
  const [stock,   setStock]   = useState([])
  const [txns,    setTxns]    = useState([])
  const [lines,   setLines]   = useState([])
  const [serials, setSerials] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [i, s, t, l, sr] = await Promise.all([
        supabase.from('wh_items').select('*').order('sort_order'),
        supabase.from('wh_stock').select('*').order('sort_order'),
        supabase.from('wh_transactions').select('*').order('txn_date', { ascending: false }).limit(400),
        supabase.from('wh_txn_lines').select('*').limit(3000),
        supabase.from('wh_serials').select('*').order('created_at', { ascending: false }).limit(2000)
      ])

      const firstError = [i, s, t, l, sr].find(r => r.error)
      if (firstError) { setError(errLine(firstError.error)); return }

      setItems(i.data || [])
      setStock(s.data || [])
      setTxns(t.data || [])
      setLines(l.data || [])
      setSerials(sr.data || [])
    } catch (err) {
      setError(`Can't reach the server — ${err.message}.`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // One movement in, one movement out. Written as a transaction header,
  // its lines, and then the serial numbers of the individual units.
  async function createTxn({ header, lines: rows, serials: serialRows }) {
    const payload = {
      txn_type:    header.txn_type,
      txn_date:    header.txn_date || new Date().toISOString().slice(0, 10),
      vendor_id:   null,
      vendor_name: header.vendor_name || null,
      site_ids:    (header.site_ids || []).map(normSiteId).filter(Boolean),
      dc_number:   header.dc_number || null,
      sreq_number: header.sreq_number || null,
      vehicle:     header.vehicle || null,
      handled_by:  header.handled_by || null,
      remarks:     header.remarks || null
    }

    const t = await supabase.from('wh_transactions').insert(payload).select().single()
    if (t.error) throw new Error(errLine(t.error))
    const txnId = t.data.id

    try {
      const lineRows = rows
        .filter(r => r.item_id && Number(r.quantity) > 0)
        .map(r => ({
          txn_id: txnId,
          item_id: r.item_id,
          item_code: r.item_code,
          item_name: r.item_name,
          quantity: Number(r.quantity),
          length_each: r.length_each === '' || r.length_each == null ? null : Number(r.length_each),
          condition: r.condition || null,
          remarks: r.remarks || null
        }))

      if (!lineRows.length) throw new Error('A movement needs at least one item with a quantity.')

      const l = await supabase.from('wh_txn_lines').insert(lineRows)
      if (l.error) throw new Error(errLine(l.error))

      await writeSerials({ txnId, header: payload, serialRows })
    } catch (err) {
      // Don't leave a headless transaction behind if the lines failed.
      await supabase.from('wh_transactions').delete().eq('id', txnId)
      throw err
    }

    await load()
    return txnId
  }

  return { items, stock, txns, lines, serials, loading, error, reload: load, createTxn }
}

// Serial numbers.
//
// Inward: each unit becomes a row, or updates one if that serial has
// been through here before (a module can come back from a site).
// Outward: the existing row is marked issued and pointed at the site.
//
// Written defensively on purpose — if the warehouse schema already has
// a trigger doing some of this, an existing row is updated rather than
// duplicated.
async function writeSerials({ txnId, header, serialRows }) {
  const clean = (serialRows || [])
    .filter(s => s.serial_no && String(s.serial_no).trim())
    .map(s => ({ ...s, serial_no: String(s.serial_no).trim().toUpperCase() }))

  if (!clean.length) return

  const nos = clean.map(s => s.serial_no)
  const { data: existing } = await supabase
    .from('wh_serials').select('id, serial_no').in('serial_no', nos)
  const idOf = new Map((existing || []).map(r => [r.serial_no, r.id]))

  const siteId = (header.site_ids || [])[0] || null

  if (header.txn_type === 'inward') {
    const fresh = []
    for (const s of clean) {
      const row = {
        serial_no: s.serial_no,
        item_id: s.item_id,
        item_code: s.item_code,
        status: 'in_stock',
        condition: s.condition || null,
        inward_txn_id: txnId,
        inward_date: header.txn_date,
        inward_vendor: header.vendor_name,
        outward_txn_id: null,
        outward_date: null,
        outward_to: null,
        site_id: s.site_id || siteId,
        remarks: s.remarks || null
      }
      const id = idOf.get(s.serial_no)
      if (id) {
        const u = await supabase.from('wh_serials').update(row).eq('id', id)
        if (u.error) throw new Error(errLine(u.error))
      } else {
        fresh.push(row)
      }
    }
    if (fresh.length) {
      const ins = await supabase.from('wh_serials').insert(fresh)
      if (ins.error) throw new Error(errLine(ins.error))
    }
  } else {
    for (const s of clean) {
      const row = {
        status: 'issued',
        outward_txn_id: txnId,
        outward_date: header.txn_date,
        outward_to: header.vendor_name,
        site_id: s.site_id || siteId,
        condition: s.condition || null
      }
      const id = idOf.get(s.serial_no)
      if (id) {
        const u = await supabase.from('wh_serials').update(row).eq('id', id)
        if (u.error) throw new Error(errLine(u.error))
      } else {
        // Going out without ever having come in. Recorded rather than
        // refused — the paperwork can be fixed later, the movement is real.
        const ins = await supabase.from('wh_serials').insert({
          serial_no: s.serial_no, item_id: s.item_id, item_code: s.item_code,
          remarks: 'issued without an inward record', ...row
        })
        if (ins.error) throw new Error(errLine(ins.error))
      }
    }
  }
}

// MT-AZNA-0042. Suggested, never forced — the code printed on the unit
// wins if there is one, and the scanner fills that in.
export function suggestSerial(itemCode, n) {
  const code = String(itemCode || 'ITEM').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return `MT-${code}-${String(n).padStart(4, '0')}`
}
