import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { mapExcelRow } from '../utils/stageLogic'
import styles from './Modal.module.css'

export default function UploadModal({ onImport, onClose }) {
  const [preview, setPreview] = useState(null)
  const [pending, setPending] = useState([])
  const inputRef = useRef()

  function processFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws)
      const mapped = data.map(mapExcelRow)
      setPending(mapped)
      setPreview({ name: file.name, count: mapped.length, sample: mapped.slice(0, 4).map(p => p.siteName).filter(Boolean) })
    }
    reader.readAsBinaryString(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    processFile(e.dataTransfer.files[0])
  }

  function confirm() {
    onImport(pending)
    onClose()
  }

  return (
    <div className={styles.modal} style={{ maxWidth: 520 }}>
      <div className={styles.header}>
        <span className={styles.title}>Upload Project Excel</span>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>
      <div className={styles.body}>
        <div className={styles.infoBox}>
          <div className={styles.infoTitle}>📋 Auto-mapped columns</div>
          <p className={styles.infoText}>
            Site ID · Site Name · Zone · City · Circle · Site Type · Toco · Layer ·
            Team Name · Team Numb · Installation Date · Dis Date · Billing Status · Remarks
          </p>
        </div>
        <div
          className={styles.dropZone}
          onClick={() => inputRef.current.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className={styles.dropIcon}>📂</div>
          <div className={styles.dropTitle}>Click to browse or drag & drop</div>
          <div className={styles.dropSub}>.xlsx or .xls · Row 1 must be headers</div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={e => processFile(e.target.files[0])}
        />
        {preview && (
          <div className={styles.previewBox}>
            <div className={styles.previewTitle}>✓ {preview.count} sites detected — {preview.name}</div>
            <div className={styles.previewSub}>
              {preview.sample.join(', ')}{preview.count > 4 ? '…' : ''}
            </div>
          </div>
        )}
      </div>
      <div className={styles.footer}>
        <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
        {preview && (
          <button className={styles.primaryBtn} onClick={confirm}>
            Import {preview.count} Sites
          </button>
        )}
      </div>
    </div>
  )
}
