import { STAGES } from '../utils/constants'
import { getStage, getStageMeta, isNotAssigned, getMissingStages, daysSince, formatDate } from '../utils/stageLogic'
import styles from './KanbanBoard.module.css'

export default function KanbanBoard({ projects, onOpen }) {
  const byStage = {}
  STAGES.forEach(s => (byStage[s.id] = []))
  projects.forEach(p => {
    const s = getStage(p)
    if (byStage[s]) byStage[s].push(p)
  })

  return (
    <div className={styles.wrap}>
      <div className={styles.board}>
        {STAGES.map(s => (
          <Column key={s.id} stage={s} items={byStage[s.id] || []} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

function Column({ stage, items, onOpen }) {
  return (
    <div className={styles.col}>
      <div className={styles.colHdr} style={{ background: stage.bg, color: stage.color }}>
        <span className={styles.colTitle}>{stage.label}</span>
        <span className={styles.colCount}>{items.length}</span>
      </div>
      <div className={styles.colBody}>
        {items.length === 0
          ? <div className={styles.empty}><span>○</span><span>No sites</span></div>
          : items.map(p => <Card key={p.id} project={p} onOpen={onOpen} />)
        }
      </div>
    </div>
  )
}

function Card({ project: p, onOpen }) {
  const d = daysSince(p.email_received_date || p.work_date)
  const notAssigned = isNotAssigned(p)
  const missing = getMissingStages(p)

  return (
    <div
      className={`${styles.card} ${notAssigned ? styles.notAssigned : ''}`}
      onClick={() => onOpen(p.id)}
    >
      <div className={styles.cardTop}>
        <div className={styles.cardTitle}>{p.site_name || 'Unnamed Site'}</div>
        {d !== null && <span className={styles.days}>{d}d</span>}
      </div>
      <div className={styles.cardId}>{p.site_id || '—'} · {p.zone || '—'}</div>

      {p.email_received_date && (
        <div className={styles.emailDate}>📧 {formatDate(p.email_received_date)}</div>
      )}

      <div className={styles.flags}>
        <Flag label="WCC" val={p.wcc_received} />
        <Flag label="Inv" val={p.invoice_done} />
        <Flag label="Paid" val={p.payment_received} />
      </div>

      {p.team_name && <div className={styles.team}>👤 {p.team_name}</div>}

      {notAssigned && (
        <div className={styles.notAssignedAlert}>⚠ Not Assigned on Ultro — Action Required</div>
      )}

      {!notAssigned && missing.length > 0 && (
        <div className={styles.warnBadge}>
          ⚠ {missing.length} earlier stage{missing.length > 1 ? 's' : ''} missing
          <div className={styles.warnTip}>
            <div className={styles.warnTipTitle}>⚠ Incomplete earlier stages</div>
            <ul>{missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
        </div>
      )}
    </div>
  )
}

function Flag({ label, val }) {
  if (!val) return <span className={`${styles.flag} ${styles.fNa}`}>{label}</span>
  if (val === 'Yes') return <span className={`${styles.flag} ${styles.fDone}`}>{label} ✓</span>
  if (val === 'No') return <span className={`${styles.flag} ${styles.fNo}`}>{label} ✗</span>
  if (val === 'Pending') return <span className={`${styles.flag} ${styles.fPend}`}>{label}…</span>
  return <span className={`${styles.flag} ${styles.fNa}`}>{label}</span>
}
