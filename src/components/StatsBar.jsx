import { getStage } from '../utils/stageLogic'
import styles from './StatsBar.module.css'

export default function StatsBar({ projects }) {
  const total = projects.length
  const active = projects.filter(p => !['done', 'new'].includes(getStage(p))).length
  const wcc = projects.filter(p => p.wccReceived === 'Pending' || (p.allTasksUltro === 'Yes' && p.wccReceived !== 'Yes')).length
  const invoice = projects.filter(p => p.wccReceived === 'Yes' && p.invoiceDone !== 'Yes').length
  const done = projects.filter(p => getStage(p) === 'done').length

  return (
    <div className={styles.bar}>
      <Stat num={total} label="Total Sites" color="blue" />
      <Stat num={active} label="Active" color="amber" />
      <Stat num={wcc} label="WCC Due" color="purple" />
      <Stat num={invoice} label="Invoice Due" color="amber" />
      <Stat num={done} label="Completed" color="green" />
    </div>
  )
}

function Stat({ num, label, color }) {
  return (
    <div className={styles.stat}>
      <div className={`${styles.num} ${styles[color]}`}>{num}</div>
      <div className={styles.label}>{label}</div>
    </div>
  )
}
