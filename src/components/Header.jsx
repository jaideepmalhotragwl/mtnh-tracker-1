import styles from './Header.module.css'

export default function Header({ onUpload, onAdd, onConfig, onExport, exporting, isLive }) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div className={styles.logo}>MT</div>
        <div className={styles.brand}>
          MTNH Tracker <span>— Tower Operations</span>
          {isLive && <span className={styles.live}>● Live</span>}
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={onConfig}>⚙ Config</button>
        <button className={styles.btn} onClick={onUpload}>↑ Upload</button>
        <button className={`${styles.btn} ${styles.export}`} onClick={onExport} disabled={exporting}>
          {exporting ? '…' : '↗'} Export to Sheets
        </button>
        <button className={`${styles.btn} ${styles.primary}`} onClick={onAdd}>+ New Site</button>
      </div>
    </header>
  )
}
