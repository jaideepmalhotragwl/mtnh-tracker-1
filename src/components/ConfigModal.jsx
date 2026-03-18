import { useState } from 'react'
import { loadConfig, saveConfig, APPS_SCRIPT } from '../utils/sheets'
import styles from './Modal.module.css'

export default function ConfigModal({ onClose }) {
  const cfg = loadConfig()
  const [url, setUrl]       = useState(cfg.url || '')
  const [tab, setTab]       = useState(cfg.tab || 'MTNH_Projects')
  const [operator, setOp]   = useState(cfg.operator || '')
  const [copied, setCopied] = useState(false)

  function save() {
    saveConfig({ url: url.trim(), tab: tab.trim() || 'MTNH_Projects', operator: operator.trim() })
    onClose()
  }

  function copy() {
    navigator.clipboard.writeText(APPS_SCRIPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={styles.modal} style={{ maxWidth: 580 }}>
      <div className={styles.header}>
        <span className={styles.title}>Google Sheets Configuration</span>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>
      <div className={styles.body}>
        <div className={styles.infoBox}>
          <div className={styles.infoTitle}>🔗 Setup Instructions</div>
          <ol className={styles.ol}>
            <li>Create a Google Sheet, name the first tab <strong>MTNH_Projects</strong></li>
            <li>Go to <strong>Extensions → Apps Script</strong></li>
            <li>Paste the script below → click <strong>Deploy → Web App</strong></li>
            <li>Set "Who has access" → <strong>Anyone</strong> → copy the URL</li>
            <li>Paste the URL in the field below and save</li>
          </ol>
        </div>

        <div className={styles.codeWrap}>
          <div className={styles.codeMeta}>
            <span>Apps Script — paste into your Sheet</span>
            <button className={styles.copyBtn} onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
          </div>
          <pre className={styles.code}>{APPS_SCRIPT}</pre>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.formGroup} style={{ gridColumn: '1/-1' }}>
            <label className={styles.label}>Apps Script Web App URL</label>
            <input
              className={styles.input}
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/…/exec"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Sheet Tab Name</label>
            <input className={styles.input} value={tab} onChange={e => setTab(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Your Name (Operator)</label>
            <input className={styles.input} value={operator} onChange={e => setOp(e.target.value)} />
          </div>
        </div>
      </div>
      <div className={styles.footer}>
        <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
        <button className={styles.primaryBtn} onClick={save}>Save Config</button>
      </div>
    </div>
  )
}
