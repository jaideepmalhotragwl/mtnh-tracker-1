import { STAGES } from '../utils/constants'
import { getStage, daysSince } from '../utils/stageLogic'
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
          <Column key={s.id} stage={s} items={byStage[s.id]} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

function Column({ stage, items, onOpen }) {
  return (
    <div className={styles.column}>
      <div className={styles.colHeader} style={{ background: stage.bg, color: stage.color }}>
        <span className={styles.colTitle}>{stage.label}</span>
        <span className={styles.colCount}>{items.length}</span>
      </div>
      <div className={styles.colBody}>
        {items.length === 0
          ? <div className={styles.empty}><span>○</span><span>No sites</span></div>
          : items.map(p => <Card key={p._id} project={p} onOpen={onOpen} />)
        }
      </div>
    </div>
  )
}

function Flag({ label, val }) {
  if (!val) return <span className={`${styles.flag} ${styles.flagNa}`}>{label}</span>
  if (val === 'Yes') return <span className={`${styles.flag} ${styles.flagDone}`}>{label} ✓</span>
  if (val === 'No') return <span className={`${styles.flag} ${styles.flagNo}`}>{label} ✗</span>
  if (val === 'Pending') return <span className={`${styles.flag} ${styles.flagPending}`}>{label}…</span>
  return <span className={`${styles.flag} ${styles.flagNa}`}>{label}</span>
}

function Card({ project: p, onOpen }) {
  const d = daysSince(p.installDate || p.disDate)
  return (
    <div className={styles.card} onClick={() => onOpen(p._id)}>
      <div className={styles.cardTop}>
        <div className={styles.cardTitle}>{p.siteName || 'Unnamed Site'}</div>
        {d !== null && <span className={styles.daysBadge}>{d}d</span>}
      </div>
      <div className={styles.cardId}>{p.siteId || '—'} · {p.zone || '—'}</div>
      <div className={styles.flags}>
        <Flag label="WCC" val={p.wccReceived} />
        <Flag label="Inv" val={p.invoiceDone} />
        <Flag label="Paid" val={p.paymentReceived} />
      </div>
      {p.teamName && <div className={styles.team}>👤 {p.teamName}</div>}
    </div>
  )
}
