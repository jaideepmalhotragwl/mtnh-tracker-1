import { Children, useState } from 'react'
import { useApp } from './store'
import { useToast } from './Toast'
import { uploadMany, uploadRaw } from './usePhotos'
import { kb } from './compress'
import { normSiteId } from './useProjects'
import { PAY_CATEGORIES, PAY_MODES } from './constants'
import { useEscape } from './useEscape'

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

  const [category, setCategory] = useState('team_advance')
  const [amount, setAmount]     = useState('')
  const [mode, setMode]         = useState('lump')
  const [vendor, setVendor]     = useState('')
  const [payTo, setPayTo]       = useState('')
  const [upi, setUpi]           = useState('')
  const [note, setNote]         = useState('')
  const [rows, setRows]         = useState([{ site_id: '', amount: '' }])
  const [qr, setQr]             = useState(null)
  const [busy, setBusy]         = useState(false)

  const cat = PAY_CATEGORIES.find(c => c.key === category)
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
      let qrUrl = null
      if (qr) qrUrl = await uploadRaw(qr, 'payment-qr').catch(() => null)

      const siteIds = mode === 'split'
        ? rows.filter(r => r.site_id).map(r => normSiteId(r.site_id))
        : rows.filter(r => r.site_id).map(r => normSiteId(r.site_id))

      await room.requestPayment({
        category, amount: Number(amount), splitMode: mode,
        siteIds, vendor: vendor || null,
        payToName: payTo || null, payToUpi: upi || null, qrUrl,
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
        <div>
          <label>Pay to</label>
          <input value={payTo} onChange={e => setPayTo(e.target.value)} />
        </div>
        <div>
          <label>UPI id</label>
          <input value={upi} onChange={e => setUpi(e.target.value)} />
        </div>
        <div>
          <label>QR code photo</label>
          <input type="file" accept="image/*" onChange={e => setQr(e.target.files?.[0] || null)} />
        </div>
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
  const [mode, setMode] = useState(PAY_MODES[0])
  const [receipt, setReceipt] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const mine = splits.filter(s => s.payment_id === payment.id)
  const canPay = !meRecord || meRecord.can_pay || meRecord.is_admin

  async function pay() {
    setBusy(true)
    try {
      let url = null
      if (receipt) url = await uploadRaw(receipt, 'payment-receipts').catch(() => null)
      await room.markPaid(payment, { by: me, mode, receiptUrl: url })
      await room.send({
        user: me,
        body: `Paid ₹${Number(payment.amount).toLocaleString('en-IN')} · ${mode}`,
        kind: 'payment', refTable: 'room_payments', refId: payment.id,
        siteIds: payment.site_ids || []
      })
      toast(
        payment.split_mode === 'split'
          ? 'Paid. Each site record now carries its share.'
          : 'Paid. Logged against the sites, posted to none.',
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
      {payment.pay_to_name && <div className="sm" style={{ marginTop: 4 }}>To {payment.pay_to_name}</div>}
      {payment.pay_to_upi && <div className="sm mono">{payment.pay_to_upi}</div>}
      {payment.qr_url && (
        <a href={payment.qr_url} target="_blank" rel="noreferrer">
          <img src={payment.qr_url} alt="QR" style={{ width: 130, marginTop: 8, borderRadius: 6 }} />
        </a>
      )}

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

      <div style={{ marginTop: 12 }}>
        <label>Paid how</label>
        <select value={mode} onChange={e => setMode(e.target.value)}>
          {PAY_MODES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div style={{ marginTop: 12 }}>
        <label>Bank receipt</label>
        <input type="file" accept="image/*,.pdf" onChange={e => setReceipt(e.target.files?.[0] || null)} />
      </div>

      <div style={{ marginTop: 12 }}>
        <label>Or decline, with a reason</label>
        <input value={reason} onChange={e => setReason(e.target.value)} />
      </div>

      <Foot>
        <button className="ok" onClick={pay} disabled={busy}>
          {busy ? 'Saving…' : 'Mark paid'}
        </button>
        <button onClick={onClose}>Cancel</button>
        <button className="danger right" onClick={decline} disabled={busy}>Decline</button>
      </Foot>
    </Frame>
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
