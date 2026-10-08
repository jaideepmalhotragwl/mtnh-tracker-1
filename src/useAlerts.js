import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────
// WHAT IS WAITING FOR ME
//
// Worked out from tables the portal already has — no new table, no
// SQL to run. The same four things the emails will cover, so when the
// email side is switched on later the two agree by construction.
//
// The badge counts things that need DOING, not things that have
// HAPPENED. A number that only ever goes up gets ignored within a
// week. The blue dot is what says "something arrived since you last
// looked"; the number is work.
// ─────────────────────────────────────────────────────────────────

const seenKey = me => `mtnh_seen_${me}`

function lastSeen(me) {
  try {
    return localStorage.getItem(seenKey(me)) || '1970-01-01T00:00:00Z'
  } catch {
    return '1970-01-01T00:00:00Z'
  }
}

export function useAlerts(me, meRecord) {
  const [items, setItems] = useState([])
  const [fresh, setFresh] = useState(0)     // arrived since the last look

  // The window is fixed when the app opens and does not move while
  // somebody is using it. Opening the bell clears the dot, but the
  // things that happened stay on the list for the rest of the session —
  // otherwise "your payment was paid" vanishes in the act of looking
  // at it, which is the one moment it was there to be read.
  const [since, setSince] = useState(() => lastSeen(me))
  useEffect(() => { setSince(lastSeen(me)) }, [me])

  const canPay = !!(meRecord?.can_pay || meRecord?.is_admin)

  const load = useCallback(async () => {
    if (!me) { setItems([]); setFresh(0); return }

    const today = new Date().toISOString().slice(0, 10)

    try {
      const [tasks, pays, settled, msgs] = await Promise.all([
        supabase.from('room_tasks')
          .select('*').eq('assigned_to', me).eq('status', 'open')
          .order('due_date', { nullsFirst: false }),

        canPay
          ? supabase.from('room_payments')
              .select('*').eq('status', 'pending').order('requested_at', { ascending: false })
          : Promise.resolve({ data: [] }),

        supabase.from('room_payments')
          .select('*').eq('requested_by', me).in('status', ['paid', 'declined'])
          .gt('paid_at', since).order('paid_at', { ascending: false }).limit(20),

        supabase.from('room_messages')
          .select('*').contains('mentions', [me])
          .gt('created_at', since).order('created_at', { ascending: false }).limit(20)
      ])

      const out = []

      for (const t of tasks.data || []) {
        const late = t.due_date && t.due_date < today
        out.push({
          id: `t_${t.id}`,
          kind: late ? 'overdue' : 'task',
          when: t.created_at,
          title: t.title,
          note: late
            ? `was due ${t.due_date}`
            : t.due_date ? `due ${t.due_date}` : `from ${t.assigned_by}`,
          isNew: t.created_at > since,
          act: true
        })
      }

      for (const p of pays.data || []) {
        out.push({
          id: `p_${p.id}`,
          kind: 'payment',
          when: p.requested_at,
          title: `₹${Number(p.amount).toLocaleString('en-IN')} to pay`,
          note: `${p.requested_by} · ${String(p.category).replace('_', ' ')}`,
          isNew: p.requested_at > since,
          act: true
        })
      }

      for (const p of settled.data || []) {
        out.push({
          id: `s_${p.id}`,
          kind: p.status === 'paid' ? 'paid' : 'declined',
          when: p.paid_at,
          title: p.status === 'paid'
            ? `₹${Number(p.amount).toLocaleString('en-IN')} was paid`
            : `₹${Number(p.amount).toLocaleString('en-IN')} was declined`,
          note: p.status === 'paid'
            ? `${p.paid_by} · ${p.paid_mode || ''}`.trim()
            : (p.decline_reason || 'no reason given'),
          isNew: true,
          act: false
        })
      }

      for (const m of msgs.data || []) {
        if (m.user_name === me) continue
        out.push({
          id: `m_${m.id}`,
          kind: 'mention',
          when: m.created_at,
          title: `${m.user_name} mentioned you`,
          note: String(m.body || '').slice(0, 70),
          isNew: true,
          act: false
        })
      }

      out.sort((a, b) => String(b.when || '').localeCompare(String(a.when || '')))
      setItems(out)
      setFresh(out.filter(i => i.isNew).length)
    } catch {
      // Offline. Leave whatever was on screen rather than blanking it.
    }
  }, [me, canPay, since])

  useEffect(() => { load() }, [load])

  // Live where the socket is up, and a slow poll underneath it so the
  // bell still catches up on a connection that keeps dropping.
  useEffect(() => {
    if (!me) return
    const ch = supabase.channel('alerts-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_tasks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_payments' }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_messages' }, load)
      .subscribe()
    const tick = setInterval(load, 60000)
    return () => { supabase.removeChannel(ch); clearInterval(tick) }
  }, [me, load])

  // Clears the dot and remembers the moment for next time. Does NOT
  // move the window this session — see the note above.
  function markSeen() {
    try { localStorage.setItem(seenKey(me), new Date().toISOString()) } catch { /* private window */ }
    setFresh(0)
  }

  // The number on the badge: things to do. Notices that something
  // happened are in the list but don't inflate the count.
  const todo = items.filter(i => i.act).length

  return { items, todo, fresh, markSeen, reload: load }
}
