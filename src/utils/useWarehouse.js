import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

export function useWarehouse() {
  const [items,   setItems]   = useState([])
  const [vendors, setVendors] = useState([])
  const [stock,   setStock]   = useState([])
  const [txns,    setTxns]    = useState([])
  const [serials, setSerials] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [i, v, s, t, sn] = await Promise.all([
        supabase.from('wh_items').select('*').eq('active', true).order('sort_order'),
        supabase.from('wh_vendors').select('*').eq('active', true).order('name'),
        supabase.from('wh_stock').select('*').order('sort_order'),
        supabase.from('wh_transactions').select('*, wh_txn_lines(*)').order('txn_date', { ascending: false }).limit(200),
        supabase.from('wh_serials').select('*').order('created_at', { ascending: false }).limit(500),
      ])
      setItems(i.data || [])
      setVendors(v.data || [])
      setStock(s.data || [])
      setTxns(t.data || [])
      setSerials(sn.data || [])
    } catch (err) {
      console.error('Warehouse load error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Save an inward or outward entry
  const saveTxn = useCallback(async (header, lines) => {
    // 1. insert header
    const { data: txn, error: e1 } = await supabase
      .from('wh_transactions')
      .insert([{
        txn_type:    header.txn_type,
        txn_date:    header.txn_date,
        vendor_id:   header.vendor_id || null,
        vendor_name: header.vendor_name || null,
        site_ids:    header.site_ids || [],
        dc_number:   header.dc_number || null,
        sreq_number: header.sreq_number || null,
        vehicle:     header.vehicle || null,
        handled_by:  header.handled_by || null,
        remarks:     header.remarks || null,
      }])
      .select().single()
    if (e1) throw e1

    // 2. insert line items
    const lineRows = lines.map(l => ({
      txn_id:      txn.id,
      item_id:     l.item_id,
      item_code:   l.item_code,
      item_name:   l.item_name,
      quantity:    Number(l.quantity) || 0,
      length_each: l.length_each ? Number(l.length_each) : null,
      condition:   l.condition || 'Good',
      remarks:     l.remarks || null,
    }))
    const { error: e2 } = await supabase.from('wh_txn_lines').insert(lineRows)
    if (e2) throw e2

    // 3. handle serial numbers
    const isIn = header.txn_type === 'inward'
    for (const l of lines) {
      if (!l.serials || l.serials.length === 0) continue
      const clean = l.serials.map(s => String(s).trim()).filter(Boolean)
      if (clean.length === 0) continue

      if (isIn) {
        // new serials enter stock
        const rows = clean.map(sn => ({
          serial_no:     sn,
          item_id:       l.item_id,
          item_code:     l.item_code,
          status:        'in_stock',
          condition:     l.condition || 'Good',
          inward_txn_id: txn.id,
          inward_date:   header.txn_date,
          inward_vendor: header.vendor_name,
        }))
        const { error } = await supabase
          .from('wh_serials')
          .upsert(rows, { onConflict: 'serial_no,item_id' })
        if (error) throw error
      } else {
        // mark existing serials as dispatched
        const { error } = await supabase
          .from('wh_serials')
          .update({
            status:         'dispatched',
            outward_txn_id: txn.id,
            outward_date:   header.txn_date,
            outward_to:     header.vendor_name,
            site_id:        (header.site_ids || [])[0] || null,
          })
          .in('serial_no', clean)
          .eq('item_id', l.item_id)
        if (error) throw error
      }
    }

    await loadAll()
    return txn
  }, [])

  const deleteTxn = useCallback(async (id) => {
    // release any serials that went out on this txn
    await supabase.from('wh_serials')
      .update({ status: 'in_stock', outward_txn_id: null, outward_date: null, outward_to: null, site_id: null })
      .eq('outward_txn_id', id)
    // remove serials that came in on this txn and are still in stock
    await supabase.from('wh_serials').delete().eq('inward_txn_id', id).eq('status', 'in_stock')
    const { error } = await supabase.from('wh_transactions').delete().eq('id', id)
    if (error) throw error
    await loadAll()
  }, [])

  // serials available to dispatch for a given item
  const availableSerials = useCallback((itemId) =>
    serials.filter(s => s.item_id === itemId && s.status === 'in_stock')
  , [serials])

  const getBalance = useCallback((itemId) => {
    const row = stock.find(s => s.item_id === itemId)
    return row ? Number(row.balance) : 0
  }, [stock])

  return {
    items, vendors, stock, txns, serials, loading,
    saveTxn, deleteTxn, availableSerials, getBalance, reload: loadAll,
  }
}
