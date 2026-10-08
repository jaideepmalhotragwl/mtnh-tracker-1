import { useState } from 'react'
import { useApp } from './store'
import { useToast } from './Toast'

// ─────────────────────────────────────────────────────────────────
// MY DAY
//
// The numbers are worked out by the database every time this renders.
// Nothing is stored, so a line here can never drift away from the
// tracker. Only the last two lines are typed by a person, and they are
// marked differently so you can always tell which is which.
// ─────────────────────────────────────────────────────────────────

const LINES = [
  ['sites_dismantled',   'Sites dismantled'],
  ['material_received',  'Material received'],
  ['material_submitted', 'Material submitted'],
  ['sreq_raised',        'SREQ raised'],
  ['sites_created',      'Sites added'],
  ['photos_posted',      'Photos posted'],
  ['tasks_closed',       'Tasks closed'],
  ['tasks_open',         'Tasks still open'],
  ['tasks_overdue',      'Tasks overdue'],
  ['payments_raised',    'Payments raised'],
  ['payments_paid',      'Payments paid']
]

export default function MyDay({ shift }) {
  const { me, vendor } = useApp()
  const toast = useToast()
  const [issues, setIssues] = useState('')
  const [notes, setNotes]   = useState('')
  const [closing, setClosing] = useState(false)

  if (!me) {
    return (
      <div className="mis">
        <h3>My day</h3>
        <div className="sm fnt">Pick your name in the top right to start your day.</div>
      </div>
    )
  }

  const mis = shift.mis || {}
  const started = shift.shift?.started_at
  const ended   = shift.shift?.ended_at

  async function end() {
    setClosing(true)
    try {
      await shift.endDay({ issues, notes })
      toast('Day closed.', 'good')
    } catch (err) {
      toast(err.message, 'bad')
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="mis">
      <div className="row" style={{ marginBottom: 8 }}>
        <h3>My day</h3>
        <span className="right xs fnt">
          {started ? `since ${new Date(started).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : ''}
        </span>
      </div>

      {vendor !== 'All' && (
        <div className="xs fnt" style={{ marginBottom: 6 }}>
          Site counts are across all vendors — the bar at the top doesn't
          reach the room.
        </div>
      )}

      {LINES.map(([k, label]) => (
        <div className="mis-line" key={k}>
          <span className="v">{mis[k] ?? '—'}</span>
          <span>{label}</span>
          <span className="src trk">tracker</span>
        </div>
      ))}

      <div className="mis-line">
        <span className="v">₹{Number(mis.payment_value || 0).toLocaleString('en-IN')}</span>
        <span>Paid out today</span>
        <span className="src trk">tracker</span>
      </div>

      {ended ? (
        <div className={`note ${shift.shift.confirmed ? 'okN' : 'warnN'}`} style={{ marginTop: 12, marginBottom: 0 }}>
          {shift.shift.confirmed
            ? 'Day closed and signed off.'
            : 'This shift auto-closed after 14 hours — nobody signed off on it.'}
        </div>
      ) : (
        <>
          <div style={{ marginTop: 12 }}>
            <label>Issues raised today</label>
            <textarea value={issues} onChange={e => setIssues(e.target.value)} style={{ minHeight: 48 }} />
            <div className="xs"><span className="src ent">entered</span></div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>For tomorrow</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ minHeight: 48 }} />
            <div className="xs"><span className="src ent">entered</span></div>
          </div>
          <button className="pri" style={{ width: '100%', marginTop: 10 }}
                  onClick={end} disabled={closing}>
            {closing ? 'Closing…' : 'End my day'}
          </button>
        </>
      )}
    </div>
  )
}
