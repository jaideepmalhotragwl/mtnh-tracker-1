import { getStageMeta, isNotAssigned, getMissingStages, daysSince } from '../utils/stageLogic'
import styles from './ListView.module.css'

export default function ListView({ projects, onOpen }) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Site ID</th><th>Site Name</th><th>Zone</th><th>Team</th>
            <th>Stage</th><th>Alert</th><th>WCC</th><th>Inv</th><th>Paid</th><th>Days</th>
          </tr>
        </thead>
        <tbody>
          {projects.length === 0 ? (
            <tr><td colSpan={10} className={styles.empty}>No projects. Upload an Excel or add a site manually.</td></tr>
          ) : projects.map(p => {
            const meta = getStageMeta(p)
            const na = isNotAssigned(p)
            const missing = getMissingStages(p)
            const d = daysSince(p.email_received_date || p.work_date)
            return (
              <tr key={p.id} onClick={() => onOpen(p.id)} className={styles.row}>
                <td><span className={styles.mono}>{p.site_id || '—'}</span></td>
                <td className={styles.name}>{p.site_name || '—'}</td>
                <td>{p.zone || '—'}</td>
                <td>{p.team_name || '—'}</td>
                <td><span className={styles.pill} style={{ background: meta.bg, color: meta.color }}>{meta.label}</span></td>
                <td>
                  {na
                    ? <span className={styles.alertPill}>🔴 Not on Ultro</span>
                    : missing.length > 0
                    ? <span className={styles.warnPill}>⚠ {missing.length} missing</span>
                    : <span className={styles.muted}>—</span>
                  }
                </td>
                <td><FlagCell val={p.wcc_received} /></td>
                <td><FlagCell val={p.invoice_done} /></td>
                <td><FlagCell val={p.payment_received} /></td>
                <td>{d !== null ? <span className={styles.mono}>{d}d</span> : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FlagCell({ val }) {
  if (val === 'Yes') return <span style={{ color: 'var(--green)', fontWeight: 600 }}>✓</span>
  if (val === 'No') return <span style={{ color: 'var(--red)', fontWeight: 600 }}>✗</span>
  if (val === 'Pending') return <span style={{ color: 'var(--amber)', fontWeight: 600 }}>…</span>
  return <span style={{ color: '#d1d5db' }}>—</span>
}
