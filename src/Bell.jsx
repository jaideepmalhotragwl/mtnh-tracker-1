import { useEffect, useRef, useState } from 'react'
import { useApp } from './store'
import { useAlerts } from './useAlerts'
import { usePush } from './usePush'
import { useToast } from './Toast'

const LOOK = {
  overdue:  { icon: '!',  colour: 'var(--red)' },
  task:     { icon: '✓',  colour: 'var(--blue)' },
  payment:  { icon: '₹',  colour: 'var(--purple)' },
  paid:     { icon: '₹',  colour: 'var(--green)' },
  declined: { icon: '₹',  colour: 'var(--red)' },
  noproof:  { icon: '📷', colour: 'var(--amber)' },
  mention:  { icon: '@',  colour: 'var(--cyan)' }
}

export default function Bell({ onGoToRoom }) {
  const { me, meRecord } = useApp()
  const { items, todo, fresh, markSeen } = useAlerts(me, meRecord)
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)

  useEffect(() => {
    function away(e) { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false) }
    function esc(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    window.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      window.removeEventListener('keydown', esc)
    }
  }, [])

  if (!me) return null

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && fresh > 0) markSeen()
  }

  const overdue = items.filter(i => i.kind === 'overdue').length

  return (
    <div className="bellwrap" ref={wrap}>
      <button className="bell" onClick={toggle} title="What's waiting for you">
        <span className="bellicon">🔔</span>
        {todo > 0 && (
          <span className={`bellcount ${overdue ? 'late' : ''}`}>{todo}</span>
        )}
        {fresh > 0 && todo === 0 && <span className="belldot" />}
      </button>

      {open && (
        <div className="bellpanel">
          <div className="bellhead">
            <b>Waiting for you</b>
            <span className="right xs mut">
              {todo === 0 ? 'nothing to do' : `${todo} to do`}
            </span>
          </div>

          {items.length === 0 && (
            <div className="bellempty">
              Nothing waiting. Tasks, payments and mentions turn up here.
            </div>
          )}

          <div className="belllist">
            {items.slice(0, 20).map(i => {
              const look = LOOK[i.kind] || LOOK.task
              return (
                <button
                  key={i.id}
                  className="bellrow"
                  onClick={() => { setOpen(false); onGoToRoom() }}
                >
                  <span className="bellmark" style={{ background: look.colour }}>
                    {look.icon}
                  </span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="bellrowt">{i.title}</span>
                    <span className="bellrown">{i.note}</span>
                  </span>
                  {i.isNew && <span className="belldot sm-dot" />}
                </button>
              )
            })}
          </div>

          <PushSwitch me={me} />
        </div>
      )}
    </div>
  )
}

// ── phone notifications on / off ─────────────────────────────────

function PushSwitch({ me }) {
  const push = usePush(me)
  const toast = useToast()

  async function on() {
    try { await push.turnOn(); toast('Notifications on for this phone.', 'good') }
    catch (err) { toast(err.message, 'bad') }
  }
  async function off() {
    try { await push.turnOff(); toast('Notifications off for this phone.') }
    catch (err) { toast(err.message, 'bad') }
  }

  return (
    <div className="bellfoot pushsw">
      {push.state === 'on' && (
        <div className="row">
          <span className="grow">📱 <b>Phone notifications on</b> for {me}</span>
          <button className="ghost tiny" disabled={push.busy} onClick={off}>Turn off</button>
        </div>
      )}

      {push.state === 'off' && (
        <>
          <button className="pri pushbtn" disabled={push.busy} onClick={on}>
            {push.busy ? 'Turning on…' : '📱 Turn on phone notifications'}
          </button>
          <div className="xs mut" style={{ marginTop: 5 }}>
            Buzzes this phone for your tasks, mentions and payments — even
            with the app closed.
          </div>
        </>
      )}

      {push.state === 'install-first' && (
        <div>
          <b>On iPhone, add the app to your home screen first.</b> In Safari
          tap Share → Add to Home Screen, open MTNH from that icon, then come
          back here.
        </div>
      )}

      {push.state === 'blocked' && (
        <div>
          <b>Notifications are blocked on this phone.</b> Allow them for MTNH
          in the phone's settings, then reopen the app.
        </div>
      )}

      {push.state === 'unsupported' && (
        <div>This browser can't show notifications. Use Chrome on Android, or the home-screen app on iPhone.</div>
      )}
    </div>
  )
}
