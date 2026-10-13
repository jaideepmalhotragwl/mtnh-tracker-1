import { useCallback, useEffect, useState } from 'react'
import { supabase, errLine } from './supabase'

// ─────────────────────────────────────────────────────────────────
// THE PAYEE BOOK
//
// A QR code belongs to a person, not to a payment. Saved once, picked
// from a list after that. The list sorts by who actually gets paid, so
// the three or four regulars sit at the top without anyone curating it.
//
// Everything here degrades quietly. If mtnh_payees.sql hasn't been run
// yet the table is missing, `ready` comes back false, and the payment
// modals fall back to the old typed name and per-payment QR upload.
// Deploying the code before running the SQL must not break paying people.
// ─────────────────────────────────────────────────────────────────

export function usePayees() {
  const [payees,  setPayees]  = useState([])
  const [ready,   setReady]   = useState(true)   // is the table there
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('payees').select('*')
        .order('times_paid', { ascending: false })
        .order('name')

      if (error) {
        // 42P01 is "relation does not exist" — the setup hasn't been run.
        setReady(false)
        setPayees([])
        setError('')
      } else {
        setReady(true)
        setPayees(data || [])
        setError('')
      }
    } catch (err) {
      setError(`Can't reach the server — ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function addPayee({ name, upiId, phone, qrUrl, vendor, note, by }) {
    const clean = String(name || '').trim()
    if (!clean) throw new Error('A payee needs a name.')

    const { data, error } = await supabase.from('payees').insert({
      name: clean,
      upi_id: upiId?.trim() || null,
      phone: phone?.trim() || null,
      qr_url: qrUrl || null,
      vendor: vendor || null,
      note: note?.trim() || null,
      created_by: by || null
    }).select().single()

    if (error) {
      if (error.code === '23505') {
        throw new Error(`${clean} is already in the payee book.`)
      }
      throw new Error(errLine(error))
    }
    await load()
    return data
  }

  // Used when someone pays a payee whose QR or UPI id was blank, or had
  // changed. The book quietly catches up rather than going stale.
  async function fillIn(payee, patch) {
    const fields = {}
    for (const [k, v] of Object.entries(patch)) {
      if (v && !payee[k]) fields[k] = v
    }
    if (!Object.keys(fields).length) return
    await supabase.from('payees').update(fields).eq('id', payee.id)
    await load()
  }

  async function updatePayee(payee, fields) {
    const { error } = await supabase.from('payees').update(fields).eq('id', payee.id)
    if (error) throw new Error(errLine(error))
    await load()
  }

  // Archive, never delete — same rule as people and vendors. An archived
  // payee keeps every payment ever made to them.
  async function archivePayee(payee) {
    return updatePayee(payee, { active: !payee.active })
  }

  const activePayees = payees.filter(p => p.active !== false)

  return { payees, activePayees, ready, loading, error, reload: load,
           addPayee, updatePayee, archivePayee, fillIn }
}

// ─────────────────────────────────────────────────────────────────
// THE REFERENCE NUMBER
// ─────────────────────────────────────────────────────────────────

// 1768 1585 6011 and 176815856011 are the same number typed two ways.
// This must strip exactly what the generated utr_key column in the
// database strips, or the duplicate check in the browser and the unique
// index in the database would disagree about what a duplicate is.
export function refKey(s) {
  const k = String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return k || null
}

// Somebody long-pressing the PhonePe receipt copies "UTR: 176815856011"
// or "Transaction ID 176815856011", label and all. Stripping the label
// here — as it is typed, so the field shows what will be saved — keeps
// refKey a faithful mirror of the database, which is what matters.
//
// Only a label followed by a separator is removed. A reference that
// genuinely begins with those letters is left alone.
const LABEL = /^\s*(utr|ref(erence)?|txn|transaction|tran|rrn|upi)\s*(no\.?|number|id)?\s*[:#\-–]?\s+?/i

export function tidyRef(s) {
  let t = String(s || '').replace(LABEL, '')
  // A trailing label fragment left by a half-finished paste.
  return t.replace(/^[\s:#\-–]+/, '')
}

// A UPI UTR is 12 digits. PhonePe also shows longer alphanumeric
// transaction ids, and a bank transfer reference can be almost
// anything, so this only rejects what is obviously not a reference.
export function refLooksWrong(s) {
  const k = refKey(s)
  if (!k) return 'Type the transaction number from the receipt.'
  if (k.length < 6) return 'That looks too short for a transaction number.'
  if (k.length > 40) return 'That looks too long for a transaction number.'
  return ''
}

// Has this reference already been used on another payment? The unique
// index is the real guarantee; this is here so the person sees a plain
// sentence instead of a database error after they have typed everything.
export async function findDuplicateRef(ref, exceptId) {
  const key = refKey(ref)
  if (!key) return null
  const { data, error } = await supabase
    .from('room_payments')
    .select('id, amount, paid_at, paid_by, pay_to_name, status')
    .eq('utr_key', key)
    .limit(2)

  // No utr_key column yet — nothing to compare against.
  if (error) return null
  return (data || []).find(p => p.id !== exceptId) || null
}

// ─────────────────────────────────────────────────────────────────
// OPENING THE UPI APP
//
// On a phone this beats showing a QR code: the QR is on the same screen
// you would have to scan it with. A upi:// link hands PhonePe or GPay
// the payee and the amount already filled in, so the only thing left to
// do is the PIN. Nothing is ever paid without the person tapping it.
// ─────────────────────────────────────────────────────────────────

export function upiLink({ upi, name, amount, note }) {
  const pa = String(upi || '').trim()
  if (!pa || !/^[\w.\-]{2,}@[A-Za-z]{2,}$/.test(pa)) return null

  const q = new URLSearchParams()
  q.set('pa', pa)
  if (name) q.set('pn', String(name).trim())
  if (amount && Number(amount) > 0) q.set('am', Number(amount).toFixed(2))
  q.set('cu', 'INR')
  if (note) q.set('tn', String(note).slice(0, 50))

  return `upi://pay?${q.toString()}`
}

// Android hands upi:// to whichever UPI app is installed. iPhone has no
// handler registered for it, so the link does nothing and the QR code is
// the way through. Show the button only where it works.
export function canOpenUpiApp() {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent || '')
}
