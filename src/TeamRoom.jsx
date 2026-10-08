import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from './store'
import { useToast } from './Toast'
import { useRoom, useShift, findSiteIds, findVendor, findMentions, createSiteFromChat } from './useRoom'
import { normSiteId } from './useProjects'
import MyDay from './MyDay'
import { PhotoModal, TaskModal, PaymentModal, PayNowModal } from './RoomModals'

export default function TeamRoom({ sites, onOpenSite }) {
  const { me, activePeople, activeVendors } = useApp()
  const room = useRoom()
  const shift = useShift(me)
  const toast = useToast()

  const [text, setText] = useState('')
  const [asks, setAsks] = useState([])     // site IDs waiting for a yes/no
  const [modal, setModal] = useState(null) // photo | task | payment
  const [payNow, setPayNow] = useState(null)
  const bottom = useRef(null)

  const known = useMemo(
    () => new Set(sites.map(s => normSiteId(s.site_id))),
    [sites]
  )
  const vendorOf = useMemo(
    () => Object.fromEntries(sites.map(s => [normSiteId(s.site_id), s.vendor])),
    [sites]
  )

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [room.messages.length, asks.length])

  const draftIds = findSiteIds(text)
  const draftVendor = findVendor(text, activeVendors)

  async function send() {
    const body = text.trim()
    if (!body) return
    if (!me) { toast('Pick your name in the top right first.', 'bad'); return }

    const ids = findSiteIds(body)
    const vendor = findVendor(body, activeVendors)
    const mentions = findMentions(body, activePeople)

    try {
      const msg = await room.send({ user: me, body, siteIds: ids, mentions })
      setText('')

      // A site ID nobody has heard of. Ask — never create silently. The
      // earlier build created things from loose text and filled up with
      // junk, so this one always shows a card first.  (R2, Q2)
      const unknown = ids.filter(id => !known.has(id))
      if (unknown.length) {
        setAsks(a => [
          ...a,
          ...unknown.map(id => ({
            id, vendor: vendor || '', messageId: msg.id, key: `${msg.id}:${id}`
          }))
        ])
      }
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  async function confirmAsk(ask) {
    if (!ask.vendor) { toast('Pick the vendor first.', 'bad'); return }
    try {
      const r = await createSiteFromChat({
        siteId: ask.id, vendor: ask.vendor, user: me, messageId: ask.messageId
      })
      if (r.status === 'created') {
        toast(`${ask.id} added under ${ask.vendor}.`, 'good')
        await room.send({
          user: me, kind: 'site_created', siteIds: [ask.id],
          body: `${ask.id} added to the tracker under ${ask.vendor}`
        })
      } else if (r.status === 'exists') {
        // One site ID = one site. We say where it already is rather than
        // making a second copy under a different vendor.  (Q4)
        toast(`${ask.id} is already in the tracker under ${r.vendor}.`, 'bad')
      } else if (r.status === 'bad_vendor') {
        toast(`"${ask.vendor}" isn't a vendor we know.`, 'bad')
      } else {
        toast('Could not add that one.', 'bad')
      }
      setAsks(a => a.filter(x => x.key !== ask.key))
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  const openTasks    = room.tasks.filter(t => t.status === 'open')
  const pendingPays  = room.payments.filter(p => p.status === 'pending')

  return (
    <div className="room">
      <div className="feed">
        <div className="feed-body">
          {room.loading && <div className="mut sm">Loading the room…</div>}
          {room.error && <div className="note badN">{room.error}</div>}

          {!room.loading && room.messages.length === 0 && (
            <div className="note info">
              Nothing said yet today. Mention a site ID and a vendor and the
              room will offer to add the site for you.
            </div>
          )}

          {room.messages.map(m => (
            <Message
              key={m.id} m={m} room={room} me={me}
              people={activePeople}
              onOpenSite={id => {
                const s = sites.find(x => normSiteId(x.site_id) === id)
                if (s) onOpenSite(s)
              }}
              onPay={p => setPayNow(p)}
            />
          ))}

          {asks.map(ask => (
            <div className="msg" key={ask.key}>
              <div className="av" style={{ background: '#c27803' }}>?</div>
              <div className="body">
                <div className="card-in ask">
                  <div className="hd">New site ID</div>
                  <div>
                    <b className="mono">{ask.id}</b> isn't in the tracker.
                    Add it and I'll link your message to it.
                  </div>
                  <div className="row wrap" style={{ marginTop: 8 }}>
                    <select style={{ width: 130 }} value={ask.vendor}
                            onChange={e => setAsks(a => a.map(x =>
                              x.key === ask.key ? { ...x, vendor: e.target.value } : x))}>
                      <option value="">Vendor…</option>
                      {activeVendors.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                    </select>
                    <button className="ok tiny" onClick={() => confirmAsk(ask)}>Add to tracker</button>
                    <button className="ghost tiny" onClick={() => setAsks(a => a.filter(x => x.key !== ask.key))}>
                      Not a site
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div ref={bottom} />
        </div>

        <div className="composer">
          {(draftIds.length > 0 || draftVendor) && (
            <div className="chips">
              {draftIds.map(id => (
                <span key={id} className={`tag ${known.has(id) ? 'good' : 'warn'}`}>
                  {id}{known.has(id) ? (vendorOf[id] ? ` · ${vendorOf[id]}` : '') : ' · new'}
                </span>
              ))}
              {draftVendor && <span className="tag v">{draftVendor}</span>}
            </div>
          )}

          <div className="composer-row">
            <textarea
              className="grow"
              placeholder={me ? 'Say something. Site IDs and vendor names are picked up automatically.' : 'Pick your name in the top right first.'}
              value={text}
              disabled={!me}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
              }}
            />
            <button className="pri" onClick={send} disabled={!me || !text.trim()}>Send</button>
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <button className="tiny" disabled={!me} onClick={() => setModal('photo')}>📷 Photos</button>
            <button className="tiny" disabled={!me} onClick={() => setModal('task')}>✓ Task</button>
            <button className="tiny" disabled={!me} onClick={() => setModal('payment')}>₹ Payment</button>
            <span className="right xs fnt">Enter sends · Shift+Enter for a new line</span>
          </div>
        </div>
      </div>

      <aside className="side">
        <MyDay shift={shift} room={room} />

        <div className="panel" style={{ padding: 12 }}>
          <h3>Open tasks <span className="mut sm">{openTasks.length}</span></h3>
          {openTasks.length === 0 && <div className="sm fnt">Nothing open.</div>}
          {openTasks.slice(0, 10).map(t => (
            <div key={t.id} className="row" style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
              <div className="grow">
                <div className="sm">{t.title}</div>
                <div className="xs fnt">
                  {t.assigned_to}{t.site_id ? ` · ${t.site_id}` : ''}
                  {t.due_date ? ` · due ${t.due_date}` : ''}
                </div>
              </div>
              {t.assigned_to === me && (
                <button className="tiny" onClick={() => room.closeTask(t, me)}>Done</button>
              )}
            </div>
          ))}
        </div>

        <div className="panel" style={{ padding: 12 }}>
          <h3>Payments waiting <span className="mut sm">{pendingPays.length}</span></h3>
          {pendingPays.length === 0 && <div className="sm fnt">Nothing waiting.</div>}
          {pendingPays.map(p => (
            <div key={p.id} className="row" style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
              <div className="grow">
                <div className="sm b">₹{Number(p.amount).toLocaleString('en-IN')}</div>
                <div className="xs fnt">{p.category.replace('_', ' ')} · {p.requested_by}</div>
              </div>
              <button className="ok tiny" onClick={() => setPayNow(p)}>Pay</button>
            </div>
          ))}
        </div>
      </aside>

      {modal === 'photo' && (
        <PhotoModal sites={sites} onClose={() => setModal(null)} room={room} />
      )}
      {modal === 'task' && (
        <TaskModal sites={sites} onClose={() => setModal(null)} room={room} />
      )}
      {modal === 'payment' && (
        <PaymentModal sites={sites} onClose={() => setModal(null)} room={room} />
      )}
      {payNow && (
        <PayNowModal payment={payNow} splits={room.splits} room={room} onClose={() => setPayNow(null)} />
      )}
    </div>
  )
}

// ── one message ──────────────────────────────────────────────────

function Message({ m, room, me, people, onOpenSite, onPay }) {
  const who = people.find(p => p.name === m.user_name)
  const task    = m.kind === 'task'    ? room.tasks.find(t => t.id === m.ref_id) : null
  const payment = m.kind === 'payment' ? room.payments.find(p => p.id === m.ref_id) : null

  return (
    <div className="msg">
      <div className="av" style={{ background: who?.colour || '#6b7280' }}>
        {who?.initials || m.user_name[0]}
      </div>
      <div className="body">
        <div>
          <span className="who">{m.user_name}</span>
          <span className="when">{time(m.created_at)}</span>
        </div>

        {m.kind === 'site_created'
          ? <div className="card-in" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <div className="hd">Added to tracker</div>{m.body}
            </div>
          : m.body && <div className="txt">{m.body}</div>}

        {m.site_ids?.length > 0 && m.kind !== 'site_created' && (
          <div className="chips" style={{ marginTop: 6 }}>
            {m.site_ids.map(id => (
              <button key={id} className="tag good tiny" style={{ border: 'none' }}
                      onClick={() => onOpenSite(id)}>{id}</button>
            ))}
          </div>
        )}

        {task && (
          <div className="card-in task">
            <div className="hd">Task · {task.status === 'done' ? 'done' : 'open'}</div>
            <div className="row">
              <div className="grow">
                <b>{task.title}</b>
                <div className="xs mut">
                  {task.assigned_to}{task.due_date ? ` · due ${task.due_date}` : ''}
                </div>
              </div>
              {task.status === 'open' && task.assigned_to === me && (
                <button className="ok tiny" onClick={() => room.closeTask(task, me)}>Mark done</button>
              )}
            </div>
          </div>
        )}

        {payment && (
          <div className="card-in pay">
            <div className="hd">
              Payment · {payment.status}
              {payment.split_mode === 'split' ? ' · split per site' : ' · one lump sum'}
            </div>
            <div className="row">
              <div className="grow">
                <b>₹{Number(payment.amount).toLocaleString('en-IN')}</b>
                <span className="sm mut"> · {payment.category.replace('_', ' ')}</span>
                {payment.pay_to_name && <div className="xs mut">to {payment.pay_to_name}</div>}
                {payment.note && <div className="xs mut">{payment.note}</div>}
              </div>
              {payment.status === 'pending' && (
                <button className="ok tiny" onClick={() => onPay(payment)}>Pay</button>
              )}
            </div>

            {payment.split_mode === 'split' && (
              <div style={{ marginTop: 6 }}>
                {room.splits.filter(s => s.payment_id === payment.id).map(s => (
                  <div key={s.id} className="row xs">
                    <span className="mono">{s.site_id}</span>
                    <span className="right">₹{Number(s.amount).toLocaleString('en-IN')}</span>
                  </div>
                ))}
                <div className="xs mut" style={{ marginTop: 4 }}>
                  Once paid, each amount lands on its own site record.
                </div>
              </div>
            )}

            {payment.split_mode === 'lump' && payment.site_ids?.length > 0 && (
              <div className="xs mut" style={{ marginTop: 6 }}>
                Tagged to {payment.site_ids.join(', ')} — logged against them, posted to none.
              </div>
            )}

            {payment.receipt_url && (
              <a className="xs" href={payment.receipt_url} target="_blank" rel="noreferrer">View receipt</a>
            )}
          </div>
        )}

        {m.kind === 'photos' && (
          <div className="card-in" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <div className="hd">Photos posted</div>{m.body}
          </div>
        )}
      </div>
    </div>
  )
}

function time(ts) {
  const d = new Date(ts)
  if (isNaN(d)) return ''
  const today = new Date().toDateString() === d.toDateString()
  const t = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  return today ? t : `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ${t}`
}
