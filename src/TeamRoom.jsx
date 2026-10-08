import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from './store'
import { useToast } from './Toast'
import { useRoom, useShift, findSiteIds, findVendor, findMentions, parseTaskCommand, createSiteFromChat } from './useRoom'
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
  const feed = useRef(null)
  const box = useRef(null)

  const known = useMemo(
    () => new Set(sites.map(s => normSiteId(s.site_id))),
    [sites]
  )
  const vendorOf = useMemo(
    () => Object.fromEntries(sites.map(s => [normSiteId(s.site_id), s.vendor])),
    [sites]
  )

  // Scroll the feed, not the page.
  //
  // scrollIntoView walks up and scrolls every ancestor that can move,
  // and on a phone — where My Day sits below the feed and the document
  // is taller than the screen — that scrolled the window instead,
  // carrying the whole conversation up off the top. Setting scrollTop
  // on the feed itself can only ever move the feed.
  useEffect(() => {
    const el = feed.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [room.messages.length, asks.length])

  const draftIds = findSiteIds(text)
  const draftVendor = findVendor(text, activeVendors)
  const draftTask = parseTaskCommand(text, activePeople)

  // The @ list, shown while someone is still typing a name at the start.
  const picking = useMemo(() => {
    const m = /^\s*@([A-Za-z][\w.-]*)?$/.exec(text)
    if (!m) return null
    const typed = (m[1] || '').toLowerCase()
    const hits = activePeople.filter(p =>
      p.name.toLowerCase().startsWith(typed) && p.name !== me)
    return hits.length ? hits : null
  }, [text, activePeople, me])

  function pickPerson(name) {
    setText(`@${name} `)
    box.current?.focus()
  }

  async function send() {
    const body = text.trim()
    if (!body) return
    if (!me) { toast('Pick your name in the top right first.', 'bad'); return }

    const ids = findSiteIds(body)
    const vendor = findVendor(body, activeVendors)
    const mentions = findMentions(body, activePeople)

    // Starts with @Name → a task, not just a line of chat. addTask posts
    // its own message into the feed, so nothing is said twice.
    const cmd = parseTaskCommand(body, activePeople)
    if (cmd) {
      try {
        await room.addTask({
          title: cmd.title,
          assignedTo: cmd.assignee,
          assignedBy: me,
          siteId: ids[0] || null
        })
        setText('')
        toast(`Task given to ${cmd.assignee}.`, 'good')
      } catch (err) {
        toast(err.message, 'bad')
      }
      return
    }

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
        <div className="feed-body" ref={feed}>
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

        </div>

        <div className="composer">
          {picking && (
            <div className="picker">
              {picking.map(p => (
                <button key={p.name} className="pickrow" onClick={() => pickPerson(p.name)}>
                  <span className="av" style={{ background: p.colour || '#6b7280' }}>
                    {p.initials || p.name[0]}
                  </span>
                  <span className="b">{p.name}</span>
                  <span className="right xs fnt">give them a task</span>
                </button>
              ))}
            </div>
          )}

          {draftTask && (
            <div className="note info" style={{ marginBottom: 8, padding: '7px 10px' }}>
              <b>Task for {draftTask.assignee}</b> — {draftTask.title}
              <span className="xs"> · they get an email</span>
            </div>
          )}

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
              ref={box}
              className="grow"
              placeholder={me
                ? 'Say something, or start with @name to give someone a task.'
                : 'Pick your name in the top right first.'}
              value={text}
              disabled={!me}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
                if (e.key === 'Escape' && picking) setText('')
              }}
            />
            <button className="pri" onClick={send} disabled={!me || !text.trim()}>
              {draftTask ? 'Assign' : 'Send'}
            </button>
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <button className="tiny" disabled={!me} onClick={() => setModal('photo')}>📷 Photos</button>
            <button className="tiny" disabled={!me} onClick={() => setModal('task')}>✓ Task</button>
            <button className="tiny" disabled={!me} onClick={() => setModal('payment')}>₹ Payment</button>
            <span className="right xs fnt">
              <b>@name</b> at the start makes a task · Enter sends
            </span>
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
            <div className="hd">
              Task · {task.status === 'done' ? 'done' : overdue(task) ? 'overdue' : 'open'}
            </div>
            <div className="row">
              <div className="grow">
                <b>{task.title}</b>
                <div className="xs mut">for {task.assigned_to}</div>
              </div>
              {task.status === 'open' && task.assigned_to === me && (
                <button className="ok tiny" onClick={() => room.closeTask(task, me)}>Mark done</button>
              )}
            </div>

            {task.status === 'open' && (
              <div className="row xs" style={{ marginTop: 6 }}>
                <span className="mut">Due</span>
                <input
                  type="date"
                  style={{ width: 140, padding: '2px 6px', fontSize: 12 }}
                  value={task.due_date || ''}
                  onChange={e => room.setTaskDue(task, e.target.value)}
                />
                {overdue(task) && <span className="tag bad">past due</span>}
                {!task.due_date && <span className="fnt">no reminder without one</span>}
              </div>
            )}
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

function overdue(task) {
  return task.status === 'open' && task.due_date &&
         task.due_date < new Date().toISOString().slice(0, 10)
}

function time(ts) {
  const d = new Date(ts)
  if (isNaN(d)) return ''
  const today = new Date().toDateString() === d.toDateString()
  const t = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  return today ? t : `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ${t}`
}
