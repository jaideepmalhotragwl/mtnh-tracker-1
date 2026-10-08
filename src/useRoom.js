import { useCallback, useEffect, useState } from 'react'
import { supabase, errLine } from './supabase'
import { resolveVendor } from './store'

// ─────────────────────────────────────────────────────────────────
// READING A SITE ID OUT OF A SENTENCE  (R2)
//
// Real IDs in this business look like MC3139, MP1004, MPGW6144,
// MPST4603 — letters then digits, no space. The pattern is tight on
// purpose: loose matching is how you end up with a database full of
// junk, which is exactly what happened on the earlier build when a
// bare @name created a task called "@name".
//
// Nothing is created from this. It only decides whether to ask.
// ─────────────────────────────────────────────────────────────────

const SITE_ID_RE = /\b([A-Z]{2,6}\d{3,6})\b/g

export function findSiteIds(text) {
  if (!text) return []
  const up = text.toUpperCase()
  const hits = new Set()
  let m
  SITE_ID_RE.lastIndex = 0
  while ((m = SITE_ID_RE.exec(up)) !== null) hits.add(m[1])
  return [...hits]
}

export function findVendor(text, vendors) {
  if (!text) return null
  for (const word of text.split(/[^\w]+/)) {
    const v = resolveVendor(vendors, word)
    if (v) return v
  }
  return null
}

export function findMentions(text, people) {
  if (!text) return []
  const out = new Set()
  for (const p of people) {
    const re = new RegExp(`@${p.name}\\b`, 'i')
    if (re.test(text)) out.add(p.name)
  }
  return [...out]
}

// Ask the database to create it. One site ID = one site, so if the ID
// is already there under another vendor it comes back as exists:<vendor>
// and nothing is written. That is the answer to Q4.
export async function createSiteFromChat({ siteId, vendor, user, messageId, siteName }) {
  const { data, error } = await supabase.rpc('create_site_from_chat', {
    p_site_id: siteId,
    p_vendor: vendor,
    p_user: user,
    p_message_id: messageId || null,
    p_site_name: siteName || null
  })
  if (error) throw new Error(errLine(error))

  if (data === 'created')     return { ok: true,  status: 'created' }
  if (data === 'bad_vendor')  return { ok: false, status: 'bad_vendor' }
  if (data === 'bad_site_id') return { ok: false, status: 'bad_site_id' }
  if (String(data).startsWith('exists:')) {
    return { ok: false, status: 'exists', vendor: String(data).slice(7) }
  }
  return { ok: false, status: 'unknown' }
}

// ─────────────────────────────────────────────────────────────────
// THE ROOM
// ─────────────────────────────────────────────────────────────────

export function useRoom() {
  const [messages, setMessages] = useState([])
  const [tasks,    setTasks]    = useState([])
  const [payments, setPayments] = useState([])
  const [splits,   setSplits]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  const load = useCallback(async () => {
    // A dropped connection is the normal state at a tower, so a failure
    // here has to end in a message rather than a spinner that never stops.
    try {
      const [m, t, p, s] = await Promise.all([
        supabase.from('room_messages').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('room_tasks').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('room_payments').select('*').order('requested_at', { ascending: false }).limit(200),
        supabase.from('room_payment_splits').select('*')
      ])
      setError(m.error ? errLine(m.error) : '')
      setMessages((m.data || []).slice().reverse())   // oldest at the top
      setTasks(t.data || [])
      setPayments(p.data || [])
      setSplits(s.data || [])
    } catch (err) {
      setError(`Can't reach the server — ${err.message}. Check the connection and reload.`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const ch = supabase.channel('room-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_messages' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_tasks' },    load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_payments' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  async function send({ user, body, siteIds = [], mentions = [], kind = 'chat', refTable = null, refId = null }) {
    const { data, error } = await supabase.from('room_messages').insert({
      user_name: user, body, kind,
      ref_table: refTable, ref_id: refId,
      site_ids: siteIds, mentions
    }).select().single()
    if (error) throw new Error(errLine(error))
    return data
  }

  async function addTask({ title, assignedTo, assignedBy, siteId, dueDate }) {
    const { data, error } = await supabase.from('room_tasks').insert({
      title, assigned_to: assignedTo, assigned_by: assignedBy,
      site_id: siteId || null, due_date: dueDate || null
    }).select().single()
    if (error) throw new Error(errLine(error))

    await send({
      user: assignedBy,
      body: `${title}${siteId ? ` · ${siteId}` : ''}`,
      kind: 'task', refTable: 'room_tasks', refId: data.id,
      siteIds: siteId ? [siteId] : [], mentions: [assignedTo]
    })
    return data
  }

  async function closeTask(task, by) {
    const { error } = await supabase.from('room_tasks').update({
      status: 'done', completed_at: new Date().toISOString(), completed_by: by
    }).eq('id', task.id)
    if (error) throw new Error(errLine(error))
  }

  // A payment request. `siteSplits` is [{site_id, amount}] when the money
  // is divided per site. Only a split posts to the site records — a lump
  // sum is logged against the sites but attributed to none of them.
  async function requestPayment({ category, amount, splitMode, siteIds, vendor, payToName, payToUpi, qrUrl, note, by, siteSplits }) {
    const { data, error } = await supabase.from('room_payments').insert({
      category, amount, split_mode: splitMode,
      site_ids: siteIds || [], vendor: vendor || null,
      pay_to_name: payToName || null, pay_to_upi: payToUpi || null,
      qr_url: qrUrl || null, note: note || null,
      requested_by: by
    }).select().single()
    if (error) throw new Error(errLine(error))

    if (splitMode === 'split' && siteSplits?.length) {
      const rows = siteSplits
        .filter(s => s.site_id && Number(s.amount) > 0)
        .map(s => ({ payment_id: data.id, site_id: s.site_id, amount: Number(s.amount) }))
      if (rows.length) {
        const r = await supabase.from('room_payment_splits').insert(rows)
        if (r.error) throw new Error(errLine(r.error))
      }
    }

    await send({
      user: by,
      body: `Payment request · ₹${Number(amount).toLocaleString('en-IN')}`,
      kind: 'payment', refTable: 'room_payments', refId: data.id,
      siteIds: siteIds || []
    })
    return data
  }

  async function markPaid(payment, { by, mode, receiptUrl }) {
    const { error } = await supabase.from('room_payments').update({
      status: 'paid', paid_by: by, paid_at: new Date().toISOString(),
      paid_mode: mode, receipt_url: receiptUrl || null
    }).eq('id', payment.id)
    if (error) throw new Error(errLine(error))
  }

  async function declinePayment(payment, { by, reason }) {
    const { error } = await supabase.from('room_payments').update({
      status: 'declined', paid_by: by, decline_reason: reason || null
    }).eq('id', payment.id)
    if (error) throw new Error(errLine(error))
  }

  return {
    messages, tasks, payments, splits, loading, error, reload: load,
    send, addTask, closeTask, requestPayment, markPaid, declinePayment
  }
}

// ─────────────────────────────────────────────────────────────────
// SHIFTS
//
// A report belongs to a shift, not a calendar date, because some of
// the team work past midnight and their day's work should not split
// across two reports. started_at is written once and never again.
// ─────────────────────────────────────────────────────────────────

export function useShift(me) {
  const [shift, setShift] = useState(null)
  const [mis,   setMis]   = useState(null)

  const open = useCallback(async () => {
    if (!me) return
    const today = new Date().toISOString().slice(0, 10)

    const found = await supabase.from('room_shifts')
      .select('*').eq('user_name', me).is('ended_at', null)
      .order('started_at', { ascending: false }).limit(1).maybeSingle()

    if (found.data) { setShift(found.data); return }

    // insert, never upsert — an upsert would rewrite started_at
    const made = await supabase.from('room_shifts')
      .insert({ user_name: me, report_date: today })
      .select().maybeSingle()

    if (made.data) setShift(made.data)
    else {
      const again = await supabase.from('room_shifts')
        .select('*').eq('user_name', me).eq('report_date', today).maybeSingle()
      setShift(again.data || null)
    }
  }, [me])

  useEffect(() => { open() }, [open])

  const loadMis = useCallback(async (vendor) => {
    if (!shift) return
    const { data } = await supabase.rpc('shift_mis', {
      p_user: me,
      p_from: shift.started_at,
      p_to: shift.ended_at || new Date().toISOString(),
      p_vendor: vendor && vendor !== 'All' ? vendor : null
    })
    setMis(Array.isArray(data) ? data[0] : data)
  }, [shift, me])

  useEffect(() => { loadMis(null) }, [loadMis])

  async function endDay({ issues, notes }) {
    if (!shift) return
    const { error } = await supabase.from('room_shifts').update({
      ended_at: new Date().toISOString(), confirmed: true,
      issues: issues || null, notes: notes || null
    }).eq('id', shift.id)
    if (error) throw new Error(errLine(error))
    setShift({ ...shift, ended_at: new Date().toISOString(), confirmed: true })
  }

  return { shift, mis, reloadMis: loadMis, endDay }
}
