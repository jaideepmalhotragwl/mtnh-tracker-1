import { useEffect, useRef, useState } from 'react'
import { useApp } from './store'
import { useAlerts } from './useAlerts'

const LOOK = {
  overdue:  { icon: '!',  colour: 'var(--red)' },
  task:     { icon: '✓',  colour: 'var(--blue)' },
  payment:  { icon: '₹',  colour: 'var(--purple)' },
  paid:     { icon: '₹',  colour: 'var(--green)' },
  declined: { icon: '₹',  colour: 'var(--red)' },
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

          <div className="bellfoot">
            Email for these is built but switched off — say the word and it
            goes on.
          </div>
        </div>
      )}
    </div>
  )
}
