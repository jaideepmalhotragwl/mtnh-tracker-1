import { useState } from 'react'
import { loadSheetConfig, saveSheetConfig, APPS_SCRIPT } from '../utils/sheets'
import styles from './Modal.module.css'

export default function ConfigModal({ onClose, onExport }) {
  const cfg = loadSheetConfig()
  const [url, setUrl] = useState(cfg.url || '')
  const [tab, setTab] = useState(cfg.tab || 'MTNH_Projects')
  const [copied, setCopied] = useState(false)

  function save() {
    saveSheetConfig({ url: url.trim(), tab: tab.trim() || 'MTNH_Projects' })
    onClose()
  }

  function copy() {
    navigator.clipboard.writeText(APPS_SCRIPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={styles.modal} style={{ maxWidth: 560 }}>
      <div className={styles.header}>
        <span className={styles.title}>⚙ Configuration</span>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>
      <div className={styles.body}>
        {/* Supabase status */}
        <div className={styles.sbCard}>
          <div className={styles.sbIcon}>⚡</div>
          <div className={styles.sbInfo}>
            <div className={styles.sbTitle}>Supabase — Live Database</div>
            <div className={styles.sbSub}>All project data · Real-time sync · Photo & PDF storage</div>
          </div>
          <div className={styles.connected}>● Connected</div>
        </div>

        {/* Sheets export */}
        <div className={styles.exportCard}>
          <div className={styles.exportTitle}>📊 Google Sheets — Export Only</div>
          <p className={styles.exportSub}>Push a full snapshot of all projects to your Sheet at any time. Does not affect the live database.</p>

          <div className={styles.codeWrap}>
            <div className={styles.codeMeta}>
              <span>Apps Script — paste into your Google Sheet</span>
              <button className={styles.copyBtn} onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
            </div>
            <pre className={styles.code}>{APPS_SCRIPT}</pre>
          </div>

          <div className={styles.formGrid} style={{ marginTop: 12 }}>
            <div className={styles.formGroup} style={{ gridColumn: '1/-1' }}>
              <label className={styles.label}>Apps Script Web App URL</label>
              <input className={styles.input} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Sheet Tab Name</label>
              <input className={styles.input} value={tab} onChange={e => setTab(e.target.value)} />
            </div>
          </div>
          <button
            style={{ width: '100%', marginTop: 10, height: 36, borderRadius: 8, border: '1px solid #bbf7d0', background: '#f0fdf4', color: 'var(--green)', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            onClick={onExport}>
            ↗ Export All Projects to Google Sheets
          </button>
        </div>
      </div>
      <div className={styles.footer}>
        <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
        <button className={styles.primaryBtn} onClick={save}>Save Config</button>
      </div>
    </div>
  )
}
