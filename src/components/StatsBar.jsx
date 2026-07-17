import { getStage, isNotAssigned, getMissingStages } from '../utils/stageLogic'
import styles from './StatsBar.module.css'

export default function StatsBar({ projects }) {
  const total = projects.length
  const notAssigned = projects.filter(isNotAssigned).length
  const warnings = projects.filter(p => getMissingStages(p).length > 0).length
  const wccDue = projects.filter(p => p.wcc_received === 'Pending' || (p.all_tasks_ultro === 'Yes' && p.wcc_received !== 'Yes')).length
  const done = projects.filter(p => getStage(p) === 'done').length

  return (
    <div className={styles.bar}>
      <div className={styles.stat}><div className={`${styles.num} ${styles.blue}`}>{total}</div><div className={styles.lbl}>Total Sites</div></div>
      <div className={styles.stat}><div className={`${styles.num} ${styles.red}`}>{notAssigned}</div><div className={styles.lbl}>Not on Ultro</div></div>
      <div className={styles.stat}><div className={`${styles.num} ${styles.orange}`}>{warnings}</div><div className={styles.lbl}>⚠ Warnings</div></div>
      <div className={styles.stat}><div className={`${styles.num} ${styles.purple}`}>{wccDue}</div><div className={styles.lbl}>WCC Due</div></div>
      <div className={styles.stat}><div className={`${styles.num} ${styles.green}`}>{done}</div><div className={styles.lbl}>Completed</div></div>
    </div>
  )
}
