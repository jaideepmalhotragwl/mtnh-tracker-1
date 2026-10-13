import { Children, useEffect, useState } from 'react'
import { useApp } from './store'
import { useToast } from './Toast'
import { uploadMany, uploadRaw } from './usePhotos'
import { kb } from './compress'
import { normSiteId } from './useProjects'
import { PAY_CATEGORIES, PAY_MODES } from './constants'
import { useEscape } from './useEscape'
import { usePayees, upiLink, canOpenUpiApp, refLooksWrong, findDuplicateRef, tidyRef } from './usePayees'

// ─────────────────────────────────────────────────────────────────
// POST PHOTOS FROM THE ROOM  (R4, R5)
//
// Identical in effect to the site form's upload slot: same table, same
// database trigger, so the stage ticks and the card moves either way.
// The only difference recorded is source = 'room'.
// ─────────────────────────────────────────────────────────────────

export function PhotoModal({ sites, onClose, room }) {
  const { me, activeStages } = useApp()
  const toast = useToast()
  const [siteId, setSiteId] = useState('')
  const [stage, setStage]   = useState(activeStages[0]?.key || '')
  const [files, setFiles]   = useState([])
  const [busy, setBusy]     = useState('')
  const [done, setDone]     = useState(null)

  const stageRow = activeStages.find(s => s.key === stage)

  async function go() {
    if (!siteId) { toast('Which site?', 'bad'); return }
    if (!stage)  { toast('Which stage?', 'bad'); return }
    if (!files.length) { toast('Pick the files first.', 'bad'); return }

    setBusy(`0 of ${files.length}`)
    try {
      const msg = await room.send({
        user: me, kind: 'photos', siteIds: [normSiteId(siteId)],
        body: `${files.length} ${stageRow.label.toLowerCase()} for ${normSiteId(siteId)}`
      })

      const out = await uploadMany(
        files,
        { siteId, stage, postedBy: me, source: 'room', messageId: msg.id },
        (n, t) => setBusy(`${n} of ${t}`)
      )

      const before = out.reduce((a, p) => a + p.originalBytes, 0)
      const after  = out.reduce((a, p) => a + p.storedBytes, 0)
      setDone({ n: out.length, before, after })
      toast(`${out.length} uploaded — ${stageRow.label} marked done.`, 'good')
    } catch (err) {
      toast(err.message, 'bad')
    } finally {
      setBusy('')
    }
  }

  return (
    <Frame title="Post photos" onClose={onClose}>
      <div className="grid2">
        <div>
          <label>Site</label>
          <input list="sites-dl" className="mono" value={siteId}
                 onChange={e => setSiteId(e.target.value.toUpperCase())} />
          <datalist id="sites-dl">
            {sites.map(s => <option key={s.id} value={s.site_id}>{s.site_name || ''}</option>)}
          </datalist>
        </div>
        <div>
          <label>Stage — you pick it, nothing is guessed</label>
          <select value={stage} onChange={e => setStage(e.target.value)}>
            {activeStages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label>Files</label>
        <input type="file" multiple accept={stageRow?.file_kind === 'pdf' ? '.pdf' : 'image/*'}
               onChange={e => { setFiles([...(e.target.files || [])]); setDone(null) }} />
      </div>

      {busy && <div className="sm mut" style={{ marginTop: 8 }}>Uploading {busy}…</div>}

      {done && (
        <div className="note okN" style={{ marginTop: 12 }}>
          ✓ {kb(done.before)} compressed to {kb(done.after)} · saved to{' '}
          <b className="mono">{normSiteId(siteId)}</b> → {stageRow.label} · stage marked done
        </div>
      )}

      <div className="sm mut" style={{ marginTop: 10 }}>
        These appear on the site form too. Nobody needs to upload twice.
      </div>

      <Foot>
        <button className="pri" onClick={go} disabled={!!busy}>
          {busy || 'Upload'}
        </button>
        <button onClick={onClose}>{done ? 'Close' : 'Cancel'}</button>
      </Foot>
    </Frame>
  )
}

// ── a task ───────────────────────────────────────────────────────

export function TaskModal({ sites, onClose, room }) {
  const { me, activePeople } = useApp()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [who, setWho]     = useState('')
  const [siteId, setSite] = useState('')
  const [due, setDue]     = useState('')

  async function go() {
    if (!title.trim()) { toast('What is the task?', 'bad'); return }
    if (!who) { toast('Who is doing it?', 'bad'); return }
    try {
      await room.addTask({
        title: title.trim(), assignedTo: who, assignedBy: me,
        siteId: siteId ? normSiteId(siteId) : null, dueDate: due || null
      })
      toast('Task assigned.', 'good')
      onClose()
    } catch (err) { toast(err.message, 'bad') }
  }

  return (
    <Frame title="Assign a task" onClose={onClose} narrow>
      <label>What needs doing</label>
      <input value={title} onChange={e => setTitle(e.target.value)} autoFocus />

      <div className="grid2" style={{ marginTop: 12 }}>
        <div>
          <label>Who</label>
          <select value={who} onChange={e => setWho(e.target.value)}>
            <option value="">—</option>
            {activePeople.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label>Due</label>
          <input type="date" value={due} onChange={e => setDue(e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label>Site (optional)</label>
        <input list="sites-dl2" className="mono" value={siteId}
               onChange={e => setSite(e.target.value.toUpperCase())} />
        <datalist id="sites-dl2">
          {sites.map(s => <option key={s.id} value={s.site_id} />)}
        </datalist>
      </div>

      <Foot>
        <button className="pri" onClick={go}>Assign</button>
        <button onClick={onClose}>Cancel</button>
      </Foot>
    </Frame>
  )
}

// ── a payment request ────────────────────────────────────────────
// Mohit raises, Deepak pays. The split decides whether the money ever
// reaches a site record.

export function PaymentModal({ sites, onClose, room }) {
  const { me, activeVendors, meRecord } = useApp()
  const toast = useToast()
  const book = usePayees()

  const [category, setCategory] = useState('team_advance')
  const [amount, setAmount]     = useState('')
  const [mode, setMode]         = useState('lump')
  const [vendor, setVendor]     = useState('')
  const [note, setNote]         = useState('')
  const [rows, setRows]         = useState([{ site_id: '', amount: '' }])
  const [busy, setBusy]         = useState(false)

  // Who is being paid. Either one from the book, or a new person whose
  // details get saved into it on the way past.
  const [payeeId, setPayeeId] = useState('')
  const [fresh, setFresh]     = useState(false)        // typing a new one
  const [payTo, setPayTo]     = useState('')
  const [upi, setUpi]         = useState('')
  const [qr, setQr]           = useState(null)
  const [keep, setKeep]       = useState(true)         // save to the book

  const picked = book.activePayees.find(p => p.id === payeeId) || null

  // No book yet — the SQL hasn't been run. Fall back to the old way of
  // typing the name and attaching a QR to this one payment.
  const typing = fresh || !book.ready

  const splitTotal = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0)
  const mismatch = mode === 'split' && amount && Math.abs(splitTotal - Number(amount)) > 0.5

  const canRequest = !meRecord || meRecord.can_request_payment || meRecord.is_admin

  async function go() {
    if (!amount || Number(amount) <= 0) { toast('How much?', 'bad'); return }
    if (mode === 'split' && !rows.some(r => r.site_id && Number(r.amount) > 0)) {
      toast('A split needs at least one site with an amount.', 'bad'); return
    }
    setBusy(true)
    try {
      let qrUrl   = picked?.qr_url || null
      let name    = picked?.name   || payTo.trim() || null
      let upiId   = picked?.upi_id || upi.trim()   || null
      let savedId = picked?.id     || null

      if (typing && qr) {
        qrUrl = await uploadRaw(qr, 'payment-qr').catch(() => null)
      }

      // A new payee with a QR is worth keeping. Next month nobody has to
      // scroll back through chat looking for this picture.
      if (typing && keep && book.ready && name) {
        try {
          const saved = await book.addPayee({
            name, upiId, qrUrl, vendor: vendor || null, by: me
          })
          savedId = saved.id
        } catch (err) {
          // Already in the book, most likely. The payment still goes out.
          toast(err.message, 'warn')
        }
      }

      const siteIds = rows.filter(r => r.site_id).map(r => normSiteId(r.site_id))

      await room.requestPayment({
        category, amount: Number(amount), splitMode: mode,
        siteIds, vendor: vendor || null,
        payToName: name, payToUpi: upiId, qrUrl,
        payeeId: book.ready ? savedId : null,
        note: note || null, by: me,
        siteSplits: mode === 'split'
          ? rows.map(r => ({ site_id: normSiteId(r.site_id), amount: Number(r.amount) }))
          : []
      })
      toast('Payment request raised.', 'good')
      onClose()
    } catch (err) {
      toast(err.message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  if (!canRequest) {
    return (
      <Frame title="Payment request" onClose={onClose} narrow>
        <div className="note warnN" style={{ margin: 0 }}>
          Your account can't raise payment requests. An admin can switch that
          on in Settings.
        </div>
        <Foot><button onClick={onClose}>Close</button></Foot>
      </Frame>
    )
  }

  return (
    <Frame title="Request a payment" onClose={onClose}>
      <div className="grid3">
        <div>
          <label>What for</label>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {PAY_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label>Amount ₹</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div>
          <label>Vendor (optional)</label>
          <select value={vendor} onChange={e => setVendor(e.target.value)}>
            <option value="">—</option>
            {activeVendors.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── who gets the money ─────────────────────────────────── */}
      <div className="panel payee-box" style={{ marginTop: 14 }}>
        <div className="row">
          <label style={{ margin: 0 }}>Pay to</label>
          {book.ready && (
            <button className="tiny right" onClick={() => { setFresh(f => !f); setPayeeId('') }}>
              {fresh ? 'Pick a saved payee' : '+ Someone new'}
            </button>
          )}
        </div>

        {!typing && (
          <>
            <select value={payeeId} onChange={e => setPayeeId(e.target.value)} style={{ marginTop: 6 }}>
              <option value="">—</option>
              {book.activePayees.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.upi_id ? ` · ${p.upi_id}` : ''}
                  {p.times_paid > 0 ? ` · paid ${p.times_paid}×` : ''}
                </option>
              ))}
            </select>
            {book.activePayees.length === 0 && (
              <div className="sm mut" style={{ marginTop: 6 }}>
                Nobody saved yet. Tap <b>+ Someone new</b> and their QR is
                kept for next time.
              </div>
            )}
            {picked && (
              <div className="row" style={{ marginTop: 10, alignItems: 'flex-start', gap: 12 }}>
                {picked.qr_url
                  ? <img className="qr-thumb" src={picked.qr_url} alt="QR" />
                  : <div className="qr-thumb none">no QR</div>}
                <div className="grow sm">
                  <b>{picked.name}</b>
                  {picked.upi_id && <div className="mono xs">{picked.upi_id}</div>}
                  {picked.phone  && <div className="xs mut">{picked.phone}</div>}
                  <div className="xs mut">
                    {picked.times_paid > 0
                      ? `Paid ${picked.times_paid} time${picked.times_paid > 1 ? 's' : ''}` +
                        (picked.last_paid_at ? `, last on ${picked.last_paid_at.slice(0, 10)}` : '')
                      : 'Never paid through the portal before'}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {typing && (
          <>
            <div className="grid3" style={{ marginTop: 6 }}>
              <div><label>Name</label>
                <input value={payTo} onChange={e => setPayTo(e.target.value)} /></div>
              <div><label>UPI id</label>
                <input placeholder="name@bank" value={upi}
                       onChange={e => setUpi(e.target.value)} /></div>
              <div><label>QR code photo</label>
                <input type="file" accept="image/*"
                       onChange={e => setQr(e.target.files?.[0] || null)} /></div>
            </div>
            {book.ready
              ? <label className="chk sm" style={{ marginTop: 8 }}>
                  <input type="checkbox" checked={keep}
                         onChange={e => setKeep(e.target.checked)} />
                  Save to the payee book — the QR is then one tap away next time
                </label>
              : <div className="sm mut" style={{ marginTop: 8 }}>
                  The payee book isn't set up yet. Run <b className="mono">mtnh_payees.sql</b>{' '}
                  in Supabase and QR codes stop needing re-uploading.
                </div>}
          </>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <label>How the money is counted</label>
        <div className="row">
          <label className="chk sm">
            <input type="radio" checked={mode === 'lump'} onChange={() => setMode('lump')} />
            One lump sum
          </label>
          <label className="chk sm">
            <input type="radio" checked={mode === 'split'} onChange={() => setMode('split')} />
            Split per site
          </label>
        </div>
        <div className="sm mut" style={{ marginTop: 4 }}>
          {mode === 'split'
            ? 'Each amount posts to its own site record once paid.'
            : 'Logged against the sites you list, posted to none of them. Use this for shipping and anything covering several sites at once.'}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label>{mode === 'split' ? 'Sites and amounts' : 'Sites this covers (optional)'}</label>
        {rows.map((r, i) => (
          <div className="row" key={i} style={{ marginBottom: 6 }}>
            <input list="sites-dl3" className="mono" placeholder="Site ID" value={r.site_id}
                   onChange={e => setRows(x => x.map((y, j) => j === i ? { ...y, site_id: e.target.value.toUpperCase() } : y))} />
            {mode === 'split' && (
              <input type="number" placeholder="₹" style={{ width: 110 }} value={r.amount}
                     onChange={e => setRows(x => x.map((y, j) => j === i ? { ...y, amount: e.target.value } : y))} />
            )}
            <button className="ghost tiny" onClick={() => setRows(x => x.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <datalist id="sites-dl3">
          {sites.map(s => <option key={s.id} value={s.site_id} />)}
        </datalist>
        <button className="tiny" onClick={() => setRows(x => [...x, { site_id: '', amount: '' }])}>
          + another site
        </button>
      </div>

      {mismatch && (
        <div className="note warnN" style={{ marginTop: 12 }}>
          The split adds up to ₹{splitTotal.toLocaleString('en-IN')} but the total
          says ₹{Number(amount).toLocaleString('en-IN')}.
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <label>Note</label>
        <input value={note} onChange={e => setNote(e.target.value)} />
      </div>

      <Foot>
        <button className="pri" onClick={go} disabled={busy}>
          {busy ? 'Raising…' : 'Raise request'}
        </button>
        <button onClick={onClose}>Cancel</button>
      </Foot>
    </Frame>
  )
}

// ── paying it ────────────────────────────────────────────────────

export function PayNowModal({ payment, splits, room, onClose }) {
  const { me, meRecord } = useApp()
  const toast = useToast()
  const book = usePayees()

  const [mode, setMode]       = useState(PAY_MODES[0])
  const [receipt, setReceipt] = useState(null)
  const [ref, setRef]         = useState('')
  const [dupe, setDupe]       = useState(null)
  const [reason, setReason]   = useState('')
  const [busy, setBusy]       = useState(false)
  const [zoom, setZoom]       = useState(false)

  const mine = splits.filter(s => s.payment_id === payment.id)
  const canPay = !meRecord || meRecord.can_pay || meRecord.is_admin

  // The payment carries its own copy of the name and QR, but the book is
  // the live version — a payee who changed their UPI id has it here.
  const payee = book.payees.find(p => p.id === payment.payee_id) || null
  const name  = payee?.name   || payment.pay_to_name
  const upi   = payee?.upi_id || payment.pay_to_upi
  const qr    = payment.qr_url || payee?.qr_url

  const deep = upiLink({ upi, name, amount: payment.amount,
                         note: (payment.site_ids || [])[0] || payment.category })

  // Cash leaves no screenshot and no reference number. Everything else
  // does, and a payment with neither is a payment nobody can check.
  const cash = /cash/i.test(mode)
  const refProblem = ref.trim() ? refLooksWrong(ref) : ''
  const hasProof = !!receipt || (!!ref.trim() && !refProblem)
  const blocked = !cash && !hasProof

  // Warn about a reused transaction number while they are still typing,
  // not after they have pressed the button. The unique index in the
  // database is the real guarantee; this is so the message is readable.
  useEffect(() => {
    const key = ref.trim()
    if (!key || refLooksWrong(key)) { setDupe(null); return }
    let live = true
    const t = setTimeout(async () => {
      const hit = await findDuplicateRef(key, payment.id)
      if (live) setDupe(hit)
    }, 400)
    return () => { live = false; clearTimeout(t) }
  }, [ref, payment.id])

  async function pay() {
    if (blocked) {
      toast('Attach the payment screenshot or type the transaction number.', 'bad')
      return
    }
    if (dupe) {
      toast('That transaction number is already on another payment.', 'bad')
      return
    }
    setBusy(true)
    try {
      let url = null
      if (receipt) url = await uploadRaw(receipt, 'payment-receipts').catch(() => null)

      const res = await room.markPaid(payment, {
        by: me, mode, receiptUrl: url, utrRef: ref.trim() || null
      })

      // The book catches up with whatever this payment taught it.
      if (payee) await book.fillIn(payee, { upi_id: upi, qr_url: qr })

      await room.send({
        user: me,
        body: `Paid ₹${Number(payment.amount).toLocaleString('en-IN')} to ${name || 'the payee'} · ${mode}` +
              (ref.trim() ? ` · ref ${ref.trim()}` : ''),
        kind: 'payment', refTable: 'room_payments', refId: payment.id,
        siteIds: payment.site_ids || []
      })

      if (res?.refWarning) toast(res.refWarning, 'warn')
      else toast(
        payment.split_mode === 'split'
          ? 'Paid, with proof. Each site record now carries its share.'
          : 'Paid, with proof. Logged against the sites, posted to none.',
        'good'
      )
      onClose()
    } catch (err) {
      toast(err.message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  async function decline() {
    try {
      await room.declinePayment(payment, { by: me, reason })
      toast('Declined.')
      onClose()
    } catch (err) { toast(err.message, 'bad') }
  }

  if (!canPay) {
    return (
      <Frame title="Pay" onClose={onClose} narrow>
        <div className="note warnN" style={{ margin: 0 }}>
          Your account can't mark payments paid. Deepak and admins can.
        </div>
        <Foot><button onClick={onClose}>Close</button></Foot>
      </Frame>
    )
  }

  return (
    <Frame title={`Pay ₹${Number(payment.amount).toLocaleString('en-IN')}`} onClose={onClose} narrow>
      <div className="sm mut">
        {payment.category.replace('_', ' ')} · requested by {payment.requested_by}
      </div>

      {/* ── step one: send the money ───────────────────────────── */}
      <div className="paystep">
        <div className="paystep-n">1</div>
        <div className="grow">
          <div className="b">Send ₹{Number(payment.amount).toLocaleString('en-IN')}
            {name ? <> to {name}</> : null}</div>

          {upi && (
            <div className="row sm" style={{ marginTop: 4, gap: 6 }}>
              <span className="mono grow">{upi}</span>
              <Copy text={upi} />
            </div>
          )}

          {qr
            ? <>
                <img className="qr-big" src={qr} alt="QR code"
                     onClick={() => setZoom(true)} />
                <div className="xs mut">Tap the code to fill the screen, then scan it from another phone.</div>
              </>
            : <div className="note warnN sm" style={{ marginTop: 8 }}>
                No QR code on this request. {upi ? 'Pay to the UPI id above.' : 'Ask ' + payment.requested_by + ' for the QR or the UPI id.'}
              </div>}

          {deep && canOpenUpiApp() && (
            <a className="btn ok upi-btn" href={deep}>
              Open UPI app for ₹{Number(payment.amount).toLocaleString('en-IN')}
            </a>
          )}
          {deep && !canOpenUpiApp() && (
            <div className="xs mut" style={{ marginTop: 6 }}>
              On an Android phone this screen offers to open PhonePe or GPay
              with the amount already filled in.
            </div>
          )}
        </div>
      </div>

      {payment.split_mode === 'split' && mine.length > 0 && (
        <div className="panel" style={{ marginTop: 12, padding: 10 }}>
          <div className="xs mut b" style={{ marginBottom: 4 }}>POSTS TO THESE SITES</div>
          {mine.map(s => (
            <div className="row sm" key={s.id}>
              <span className="mono">{s.site_id}</span>
              <span className="right">₹{Number(s.amount).toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── step two: prove it ─────────────────────────────────── */}
      <div className="paystep">
        <div className="paystep-n">2</div>
        <div className="grow">
          <div className="b">Show the proof</div>

          <div style={{ marginTop: 8 }}>
            <label>Paid how</label>
            <select value={mode} onChange={e => setMode(e.target.value)}>
              {PAY_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div style={{ marginTop: 10 }}>
            <label>Payment screenshot</label>
            <input type="file" accept="image/*,.pdf" capture="environment"
                   onChange={e => setReceipt(e.target.files?.[0] || null)} />
            {receipt && <div className="xs ok-t">✓ {receipt.name}</div>}
          </div>

          {book.ready && (
            <div style={{ marginTop: 10 }}>
              <label>Transaction number from the receipt</label>
              <input className="mono" inputMode="numeric" placeholder="176815856011"
                     value={ref} onChange={e => setRef(tidyRef(e.target.value))} />
              {refProblem && <div className="xs bad-t">{refProblem}</div>}
              {dupe && (
                <div className="note badN sm" style={{ marginTop: 6 }}>
                  <b>Already used.</b> That number is on a payment of
                  ₹{Number(dupe.amount).toLocaleString('en-IN')}
                  {dupe.pay_to_name ? ` to ${dupe.pay_to_name}` : ''}
                  {dupe.paid_at ? `, marked paid on ${dupe.paid_at.slice(0, 10)}` : ''}.
                  Check you aren't sending the same screenshot twice.
                </div>
              )}
              {!refProblem && !dupe && (
                <div className="xs mut">
                  The long number PhonePe calls the transaction ID. It makes the
                  payment findable in the bank statement.
                </div>
              )}
            </div>
          )}

          {blocked && (
            <div className="note warnN sm" style={{ marginTop: 10 }}>
              A payment with no screenshot and no number can't be checked by
              anyone later. Add one, or switch the mode to Cash.
            </div>
          )}
          {cash && !hasProof && (
            <div className="xs mut" style={{ marginTop: 8 }}>
              Cash — recorded on {me}'s word, with nothing behind it.
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label>Or decline, with a reason</label>
        <input value={reason} onChange={e => setReason(e.target.value)} />
      </div>

      {zoom && qr && (
        <div className="qr-full" onClick={() => setZoom(false)}>
          <img src={qr} alt="QR code" />
          <div className="qr-full-t">
            {name}{upi ? ` · ${upi}` : ''} · ₹{Number(payment.amount).toLocaleString('en-IN')}
            <div className="xs">Tap anywhere to close</div>
          </div>
        </div>
      )}

      <Foot>
        <button className="ok" onClick={pay} disabled={busy || !!dupe}>
          {busy ? 'Saving…' : 'Mark paid'}
        </button>
        <button onClick={onClose}>Cancel</button>
        <button className="danger right" onClick={decline} disabled={busy}>Decline</button>
      </Foot>
    </Frame>
  )
}

// A UPI id is long and easy to mistype. One tap beats reading it across
// to another app.
function Copy({ text }) {
  const [hit, setHit] = useState(false)
  return (
    <button className="tiny" onClick={async () => {
      try {
        await navigator.clipboard.writeText(text)
        setHit(true); setTimeout(() => setHit(false), 1500)
      } catch { /* no clipboard permission — the text is on screen anyway */ }
    }}>{hit ? 'copied' : 'copy'}</button>
  )
}

// ── shared shell ─────────────────────────────────────────────────

function Frame({ title, onClose, narrow, children }) {
  useEscape(onClose)
  const all  = Children.toArray(children)
  const foot = all.filter(c => c?.type === Foot)
  const body = all.filter(c => c?.type !== Foot)
  return (
    <div className="scrim" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${narrow ? 'narrow' : ''}`}>
        <div className="modal-h">
          <h2>{title}</h2>
          <button className="ghost right" onClick={onClose}>Close</button>
        </div>
        <div className="modal-b">{body}</div>
        {foot}
      </div>
    </div>
  )
}

function Foot({ children }) {
  return <div className="modal-f">{children}</div>
}
