import styles from './Header.module.css'

export default function Header({ onUpload, onAdd, onConfig, onSync, syncing }) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div className={styles.logo}>MT</div>
        <div>
          <div className={styles.brand}>
            MTNH Tracker <span>— Tower Operations</span>
          </div>
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={onConfig}>⚙ Config</button>
        <button className={styles.btn} onClick={onUpload}>↑ Upload</button>
        <button className={`${styles.btn} ${styles.btnSync}`} onClick={onSync} disabled={syncing}>
          {syncing ? '…' : '⇅'} Sheets
        </button>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onAdd}>+ New Site</button>
      </div>
    </header>
  )
}
