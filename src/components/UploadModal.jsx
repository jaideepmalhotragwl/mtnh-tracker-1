import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { mapExcelRow } from '../utils/stageLogic'
import styles from './Modal.module.css'

export default function UploadModal({ onImport, onClose }) {
  const [file, setFile] = useState(null)
  const [sheets, setSheets] = useState([])       // all sheet names found
  const [selected, setSelected] = useState(null) // chosen sheet name
  const [preview, setPreview] = useState(null)   // { count, sample }
  const [pending, setPending] = useState([])
  const [workbook, setWorkbook] = useState(null)
  const inputRef = useRef()

  // Step 1 — read file, show sheet list
  function processFile(f) {
    if (!f) return
    setFile(f)
    setSelected(null)
    setPreview(null)
    setPending([])
    const reader = new FileReader()
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type: 'binary', cellDates: true })
      setWorkbook(wb)
      setSheets(wb.SheetNames)
    }
    reader.readAsBinaryString(f)
  }

  // Step 2 — user picks a sheet, parse it
  function pickSheet(sheetName) {
    setSelected(sheetName)
    const ws = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(ws, { defval: '' })
    const mapped = data.map(row => ({
      ...mapExcelRow(row),
      source_sheet: sheetName,   // store which sheet this came from
    }))
    setPending(mapped)
    setPreview({
      count: mapped.length,
      sample: mapped.slice(0, 4).map(p => p.site_name || p.site_id).filter(Boolean),
    })
  }

  function confirm() {
    onImport(pending)
    onClose()
  }

  return (
    <div className={styles.modal} style={{ maxWidth: 540 }}>
      <div className={styles.header}>
        <span className={styles.title}>↑ Upload Project Excel</span>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div className={styles.body}>
        {/* STEP 1 — Drop zone */}
        <div className={styles.infoBox}>
          <div className={styles.infoTitle}>📋 How it works</div>
          <p className={styles.infoText}>
            Upload your Excel file → choose which sheet to import → sites are labelled with the sheet name so you know where they came from.
          </p>
        </div>

        <div
          className={styles.dropZone}
          onClick={() => inputRef.current.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); processFile(e.dataTransfer.files[0]) }}
        >
          <div className={styles.dropIcon}>📂</div>
          <div className={styles.dropTitle}>{file ? file.name : 'Click to browse or drag & drop'}</div>
          <div className={styles.dropSub}>.xlsx or .xls · All sheets will be listed</div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={e => processFile(e.target.files[0])}
        />

        {/* STEP 2 — Sheet picker */}
        {sheets.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
              {sheets.length} sheet{sheets.length > 1 ? 's' : ''} found — select one to import:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sheets.map(s => (
                <div
                  key={s}
                  onClick={() => pickSheet(s)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: `1.5px solid ${selected === s ? '#1a56db' : '#e5e7eb'}`,
                    background: selected === s ? '#eff6ff' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all .12s',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: selected === s ? '#1a56db' : '#1a1a1a' }}>
                      {selected === s ? '✓ ' : ''}{s}
                    </div>
                    {selected === s && preview && (
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                        {preview.count} sites · {preview.sample.join(', ')}{preview.count > 4 ? '…' : ''}
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 500,
                    background: selected === s ? '#dbeafe' : '#f3f4f6',
                    color: selected === s ? '#1e40af' : '#9ca3af',
                    padding: '2px 8px', borderRadius: 20,
                  }}>
                    {selected === s ? 'Selected' : 'Click to select'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3 — Preview */}
        {preview && selected && (
          <div className={styles.previewBox}>
            <div className={styles.previewTitle}>
              ✓ {preview.count} sites ready from "{selected}"
            </div>
            <div className={styles.previewSub}>
              Each site will be labelled: <strong>{selected}</strong>
            </div>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
        {preview && selected && (
          <button className={styles.primaryBtn} onClick={confirm}>
            Import {preview.count} Sites → Supabase
          </button>
        )}
      </div>
    </div>
  )
}
