import { getStage, getStageMeta, daysSince } from '../utils/stageLogic'
import styles from './ListView.module.css'

function Flag({ val }) {
  if (!val) return <span className={`${styles.flag} ${styles.na}`}>—</span>
  if (val === 'Yes') return <span className={`${styles.flag} ${styles.yes}`}>✓</span>
  if (val === 'No') return <span className={`${styles.flag} ${styles.no}`}>✗</span>
  if (val === 'Pending') return <span className={`${styles.flag} ${styles.pending}`}>…</span>
  return <span className={`${styles.flag} ${styles.na}`}>—</span>
}

export default function ListView({ projects, onOpen }) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Site ID</th>
            <th>Site Name</th>
            <th>Zone</th>
            <th>Team</th>
            <th>Stage</th>
            <th>WCC</th>
            <th>Inv</th>
            <th>Paid</th>
            <th>Days</th>
          </tr>
        </thead>
        <tbody>
          {projects.length === 0 ? (
            <tr>
              <td colSpan={9} className={styles.empty}>
                No projects yet — upload an Excel file or add a site manually.
              </td>
            </tr>
          ) : projects.map(p => {
            const meta = getStageMeta(p)
            const d = daysSince(p.installDate || p.disDate)
            return (
              <tr key={p._id} onClick={() => onOpen(p._id)} className={styles.row}>
                <td><span className={styles.mono}>{p.siteId || '—'}</span></td>
                <td className={styles.name}>{p.siteName || '—'}</td>
                <td>{p.zone || '—'}</td>
                <td>{p.teamName || '—'}</td>
                <td>
                  <span className={styles.pill} style={{ background: meta.bg, color: meta.color }}>
                    {meta.label}
                  </span>
                </td>
                <td><Flag val={p.wccReceived} /></td>
                <td><Flag val={p.invoiceDone} /></td>
                <td><Flag val={p.paymentReceived} /></td>
                <td>{d !== null ? <span className={styles.mono}>{d}d</span> : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
