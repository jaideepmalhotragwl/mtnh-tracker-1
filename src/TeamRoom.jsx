import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from './store'
import { useToast } from './Toast'
import { useRoom, useShift, findSiteIds, findVendor, findMentions, parseTaskCommand, parseSiteBatch, applySiteBatch } from './useRoom'
import { normSiteId } from './useProjects'
import MyDay from './MyDay'
import { PhotoModal, TaskModal, PaymentModal, PayNowModal } from './RoomModals'

export default function TeamRoom({ sites, onOpenSite }) {
  const { me, activePeople, activeVendors, vendor: appVendor } = useApp()
  const room = useRoom()
  const shift = useShift(me)
  const toast = useToast()

  const [text, setText] = useState('')
  const [asks, setAsks] = useState([])     // site IDs waiting for a yes/no
  const [modal, setModal] = useState(null) // photo | task | payment
  const [payNow, setPayNow] = useState(null)
  const [busy, setBusy] = useState(null)
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

      // Site IDs in the message. Ask — never create silently. The earlier
      // build created things from loose text and filled a database with
      // junk, so this always shows a card first.  (R2, Q2)
      //
      // One card for the whole message, not one per site: a day's list
      // is six or seven lines and six separate cards is unusable.
      const batch = parseSiteBatch(body)
      if (batch.length) {
        setAsks(a => [...a, {
          key: msg.id,
          messageId: msg.id,
          items: batch.map(x => ({ ...x, exists: known.has(x.id) })),
          vendor: vendor || (appVendor !== 'All' && appVendor !== 'Unassigned' ? appVendor : ''),
          team: '',
          workToday: false
        }])
      }
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  async function confirmAsk(ask) {
    if (!ask.vendor) { toast('Pick the vendor first.', 'bad'); return }
    setBusy(ask.key)
    try {
      const r = await applySiteBatch({
        items: ask.items, vendor: ask.vendor, team: ask.team,
        workToday: ask.workToday, user: me
      })

      const bits = []
      if (r.created.length) bits.push(`${r.created.length} added`)
      if (r.updated.length) bits.push(`${r.updated.length} updated`)
      if (r.failed.length)  bits.push(`${r.failed.length} failed`)

      if (r.created.length || r.updated.length) {
        await room.send({
          user: me, kind: 'site_created',
          siteIds: [...r.created, ...r.updated],
          body: `${bits.join(', ')} under ${ask.vendor}` +
                (ask.workToday ? ' · work marked started today' : '')
        })
      }
      if (r.failed.length) toast(r.failed[0], 'bad')
      else toast(`${bits.join(', ')}.`, 'good')

      setAsks(a => a.filter(x => x.key !== ask.key))
    } catch (err) {
      toast(err.message, 'bad')
    } finally {
      setBusy(null)
    }
  }

  function patchAsk(key, patch) {
    setAsks(a => a.map(x => x.key === key ? { ...x, ...patch } : x))
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

          {asks.map(ask => {
            const cities = [...new Set(ask.items.map(i => i.city || '—'))]
            const nNew = ask.items.filter(i => !i.exists).length
            const nOld = ask.items.length - nNew
            return (
            <div className="msg" key={ask.key}>
              <div className="av" style={{ background: '#c27803' }}>?</div>
              <div className="body">
                <div className="card-in ask">
                  <div className="hd">
                    {ask.items.length} site{ask.items.length > 1 ? 's' : ''} in this message
                  </div>

                  <div className="batch">
                    {cities.map(c => (
                      <div className="bcity" key={c}>
                        <div className="bcity-n">{c}</div>
                        <div className="bids">
                          {ask.items.filter(i => (i.city || '—') === c).map(i => (
                            <span key={i.id} className={`tag ${i.exists ? '' : 'good'}`}>
                              {i.id}{i.exists ? ' · already in' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="sm mut" style={{ marginTop: 8 }}>
                    {nNew > 0 && `${nNew} to add`}
                    {nNew > 0 && nOld > 0 && ' · '}
                    {nOld > 0 && `${nOld} already in the tracker, city and team will be updated`}
                  </div>

                  <div className="row wrap" style={{ marginTop: 10, gap: 8 }}>
                    <select style={{ width: 120 }} value={ask.vendor}
                            onChange={e => patchAsk(ask.key, { vendor: e.target.value })}>
                      <option value="">Vendor…</option>
                      {activeVendors.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                    </select>
                    <input
                      style={{ width: 150 }} list="batch-people" placeholder="Team (optional)"
                      value={ask.team}
                      onChange={e => patchAsk(ask.key, { team: e.target.value })} />
                    <datalist id="batch-people">
                      {activePeople.map(p => <option key={p.name} value={p.name} />)}
                    </datalist>
                  </div>

                  <label className="chk sm" style={{ marginTop: 10 }}>
                    <input type="checkbox" checked={ask.workToday}
                           onChange={e => patchAsk(ask.key, { workToday: e.target.checked })} />
                    Mark work started today
                  </label>
                  {ask.workToday && (
                    <div className="xs mut" style={{ marginLeft: 24 }}>
                      Moves them to Work Initiated. They will show as needing
                      dismantle photos until someone uploads them.
                    </div>
                  )}

                  <div className="row wrap" style={{ marginTop: 10, gap: 8 }}>
                    <button className="ok tiny" disabled={busy === ask.key}
                            onClick={() => confirmAsk(ask)}>
                      {busy === ask.key ? 'Working…' : 'Add to tracker'}
                    </button>
                    <button className="ghost tiny" disabled={busy === ask.key}
                            onClick={() => setAsks(a => a.filter(x => x.key !== ask.key))}>
                      Not sites
                    </button>
                  </div>
                </div>
              </div>
            </div>
            )
          })}

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
                <button className="tiny" onClick={async () => {
                  try { await room.closeTask(t, me); toast('Task closed.', 'good') }
                  catch (err) { toast(err.message, 'bad') }
                }}>Done</button>
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
  const toast = useToast()
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
                <button className="ok tiny" onClick={async () => {
                  try { await room.closeTask(task, me); toast('Task closed.', 'good') }
                  catch (err) { toast(err.message, 'bad') }
                }}>Mark done</button>
              )}
            </div>

            {task.status === 'open' && (
              <div className="row xs" style={{ marginTop: 6 }}>
                <span className="mut">Due</span>
                <input
                  type="date"
                  style={{ width: 140, padding: '2px 6px', fontSize: 12 }}
                  value={task.due_date || ''}
                  onChange={async e => {
                    const v = e.target.value
                    try {
                      await room.setTaskDue(task, v)
                      toast(v ? `Due ${v}.` : 'Due date cleared.', 'good')
                    } catch (err) {
                      toast(err.message, 'bad')
                    }
                  }}
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

            {payment.status === 'paid' && (
              <div className="proof">
                {payment.receipt_url && (
                  <a className="tag good" href={payment.receipt_url} target="_blank" rel="noreferrer">
                    View screenshot
                  </a>
                )}
                {payment.utr_ref && (
                  <span className="tag mono" title="Transaction number">
                    ref {payment.utr_ref}
                  </span>
                )}
                {!payment.receipt_url && !payment.utr_ref && (
                  <span className="tag warn">
                    no proof{/cash/i.test(payment.paid_mode || '') ? ' — cash' : ''}
                  </span>
                )}
                <span className="xs fnt">
                  {payment.paid_by}{payment.paid_mode ? ` · ${payment.paid_mode}` : ''}
                </span>
              </div>
            )}

            {payment.status === 'pending' && payment.qr_url && (
              <a className="xs" href={payment.qr_url} target="_blank" rel="noreferrer">
                QR code for {payment.pay_to_name || 'the payee'}
              </a>
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
