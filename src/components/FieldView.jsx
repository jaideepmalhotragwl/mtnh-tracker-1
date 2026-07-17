import { useState } from 'react'
import { STAGE_STEPS, STAGES } from '../utils/constants'
import { getStageMeta, getStageIndex, isNotAssigned, getMissingStages, formatDate } from '../utils/stageLogic'
import styles from './FieldView.module.css'

export default function FieldView({ projects, onOpen }) {
  const [search, setSearch] = useState('')
  const filtered = projects.filter(p =>
    !search || (p.site_name || '').toLowerCase().includes(search.toLowerCase()) || (p.site_id || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className={styles.wrap}>
      <input className={styles.search} placeholder="Search site…" value={search} onChange={e => setSearch(e.target.value)} />
      <p className={styles.hint}>Tap a site to update its current stage</p>
      {filtered.length === 0 && <div className={styles.empty}>No sites found</div>}
      {filtered.map(p => {
        const meta = getStageMeta(p)
        const na = isNotAssigned(p)
        const missing = getMissingStages(p)
        return (
          <div key={p.id} className={`${styles.row} ${na ? styles.naRow : ''}`} onClick={() => onOpen(p.id)}>
            <div className={styles.info}>
              <div className={styles.name}>{p.site_name || 'Unnamed Site'}</div>
              <div className={styles.meta}>{p.site_id || '—'} · {p.zone || '—'}{p.team_name ? ` · ${p.team_name}` : ''}</div>
              {p.email_received_date && <div className={styles.emailDate}>📧 {formatDate(p.email_received_date)}</div>}
            </div>
            <div className={styles.badges}>
              <span className={styles.pill} style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
              {na && <span className={styles.alertPill}>🔴</span>}
              {!na && missing.length > 0 && <span className={styles.warnPill}>⚠{missing.length}</span>}
            </div>
            <span className={styles.chevron}>›</span>
          </div>
        )
      })}
    </div>
  )
}
