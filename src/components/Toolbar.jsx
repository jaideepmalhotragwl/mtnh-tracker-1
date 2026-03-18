import styles from './Toolbar.module.css'

const VIEWS = [
  { id: 'kanban', label: 'Kanban' },
  { id: 'list',   label: 'List' },
  { id: 'field',  label: '📱 Field' },
]

export default function Toolbar({ search, onSearch, zone, onZone, team, onTeam, zones, teams, view, onView }) {
  return (
    <div className={styles.toolbar}>
      <input
        className={styles.search}
        placeholder="Search site name or ID…"
        value={search}
        onChange={e => onSearch(e.target.value)}
      />
      <select className={styles.select} value={zone} onChange={e => onZone(e.target.value)}>
        <option value="">All Zones</option>
        {zones.map(z => <option key={z} value={z}>{z}</option>)}
      </select>
      <select className={styles.select} value={team} onChange={e => onTeam(e.target.value)}>
        <option value="">All Teams</option>
        {teams.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <div className={styles.spacer} />
      <div className={styles.tabs}>
        {VIEWS.map(v => (
          <button
            key={v.id}
            className={`${styles.tab} ${view === v.id ? styles.active : ''}`}
            onClick={() => onView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  )
}
