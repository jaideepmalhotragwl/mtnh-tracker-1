import { useState, useRef } from 'react'
import { newProject, getStageMeta, getStageIndex, isNotAssigned, getMissingStages } from '../utils/stageLogic'
import { STAGES, PAYMENT_MODES } from '../utils/constants'
import { supabase } from '../utils/supabase'
import styles from './ProjectForm.module.css'

// ── helpers ──────────────────────────────────────────────────
function pct(p) {
  const idx = getStageIndex(p)
  return Math.round((idx / (STAGES.length - 1)) * 100)
}

function YN({ label, value, onChange, hasPending }) {
  const opts = hasPending ? ['Yes', 'No', 'Pending'] : ['Yes', 'No']
  return (
    <div className={styles.fg}>
      <label className={styles.lbl}>{label}</label>
      <div className={styles.tglGrp}>
        {opts.map(o => (
          <button key={o} type="button"
            className={`${styles.tgl} ${value === o ? (o === 'Yes' ? styles.tYes : o === 'No' ? styles.tNo : styles.tPend) : ''}`}
            onClick={() => onChange(o)}>{o}</button>
        ))}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', full, placeholder }) {
  return (
    <div className={`${styles.fg} ${full ? styles.full : ''}`}>
      <label className={styles.lbl}>{label}</label>
      <input type={type} className={styles.input} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder }) {
  return (
    <div className={`${styles.fg} ${styles.full}`}>
      <label className={styles.lbl}>{label}</label>
      <textarea className={styles.textarea} value={value || ''} onChange={e => onChange(e.target.value)} rows={3} placeholder={placeholder} />
    </div>
  )
}

function ModeSelect({ label, value, onChange }) {
  return (
    <div className={styles.fg}>
      <label className={styles.lbl}>{label}</label>
      <select className={styles.input} value={value || ''} onChange={e => onChange(e.target.value)}>
        <option value="">Select mode</option>
        {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  )
}

function SecHeader({ num, label, status }) {
  const cls = status === 'done' ? styles.sbDone : status === 'warn' ? styles.sbWarn : status === 'flex' ? styles.sbFlex : styles.sbEmpty
  return (
    <div className={styles.sec}>
      <span>{num}. {label}</span>
      {status && <span className={`${styles.secBadge} ${cls}`}>{status === 'done' ? '✓ Done' : status === 'warn' ? 'Incomplete' : status === 'flex' ? 'Flexible' : 'Pending'}</span>}
    </div>
  )
}

// ── Photo upload ──────────────────────────────────────────────
function PhotoUpload({ value, onChange, siteId }) {
  const [uploading, setUploading] = useState(false)
  const ref = useRef()

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${siteId || 'unknown'}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('packing-photos').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('packing-photos').getPublicUrl(path)
      onChange(data.publicUrl)
    } catch (err) {
      alert('Photo upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={`${styles.fg} ${styles.full}`}>
      <label className={styles.lbl}>Packing Photo</label>
      <div className={`${styles.fileArea} ${styles.photoArea}`}>
        <div className={styles.fileIcon}>📷</div>
        <div className={styles.fileTitle}>Upload packing photo</div>
        <div className={styles.fileSub}>JPG or PNG · Stored in Supabase</div>
        {value && <div className={styles.fileUploaded}>✓ Photo uploaded — <a href={value} target="_blank" rel="noreferrer">View</a></div>}
        <button type="button" className={`${styles.uploadBtn} ${styles.photoBtn}`} onClick={() => ref.current.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : value ? '📷 Replace Photo' : '📷 Choose Photo'}
        </button>
        <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      </div>
    </div>
  )
}

// ── PDF upload ────────────────────────────────────────────────
function PdfUpload({ value, onChange, siteId }) {
  const [uploading, setUploading] = useState(false)
  const ref = useRef()

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const path = `${siteId || 'unknown'}/${Date.now()}.pdf`
      const { error } = await supabase.storage.from('signed-dc').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('signed-dc').getPublicUrl(path)
      onChange(data.publicUrl)
    } catch (err) {
      alert('PDF upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={`${styles.fg} ${styles.full}`}>
      <label className={styles.lbl}>Signed DC (PDF)</label>
      <div className={`${styles.fileArea} ${styles.pdfArea}`}>
        <div className={styles.fileIcon}>📄</div>
        <div className={styles.fileTitle}>Upload Signed DC document</div>
        <div className={styles.fileSub}>PDF only · Stored securely in Supabase</div>
        {value && <div className={styles.fileUploaded}>✓ PDF uploaded — <a href={value} target="_blank" rel="noreferrer">View</a></div>}
        <button type="button" className={`${styles.uploadBtn} ${styles.pdfBtn}`} onClick={() => ref.current.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : value ? '📄 Replace PDF' : '📄 Choose PDF'}
        </button>
        <input ref={ref} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFile} />
      </div>
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────
export default function ProjectForm({ project, onSave, onDelete, onClose }) {
  const [p, setP] = useState(() => project ? { ...project } : newProject())
  const [saving, setSaving] = useState(false)

  const s = (k, v) => setP(prev => ({ ...prev, [k]: v }))

  const stagePct = pct(p)
  const na = isNotAssigned(p)
  const missing = getMissingStages(p)
  const stageMeta = getStageMeta(p)
  const isEdit = !!project

  async function handleSave() {
    if (!p.site_name && !p.site_id) { alert('Please enter at least a Site Name or Site ID'); return }
    setSaving(true)
    try { await onSave(p) } finally { setSaving(false) }
  }

  function secStatus(doneKey, doneVal = 'Yes') {
    if (p[doneKey] === doneVal) return 'done'
    return ''
  }

  return (
    <div className={styles.modal}>
      <div className={styles.hdr}>
        <div>
          {isEdit && <div className={styles.sub}>{p.site_id}</div>}
          <div className={styles.title}>{isEdit ? `Update — ${p.site_name || 'Site'}` : 'New Site'}</div>
        </div>
        <button className={styles.close} onClick={onClose}>✕</button>
      </div>

      <div className={styles.body}>
        {/* PROGRESS */}
        <div className={styles.progress}>
          <div className={styles.progressTop}>
            <span className={styles.progressLabel}>{stageMeta.label}</span>
            <span className={styles.progressPct}>{stagePct}%</span>
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${stagePct}%` }} />
          </div>
          <div className={styles.progressMeta}>{STAGES.findIndex(s => s.id === stageMeta.id) + 1} of {STAGES.length} stages reached</div>
        </div>

        {/* NOT ASSIGNED ALERT */}
        {na && (
          <div className={styles.naBox}>
            <div className={styles.naIcon}>⚠</div>
            <div>
              <div className={styles.naTitle}>Not Assigned on Ultro — Action Required</div>
              <div className={styles.naSub}>Contact the client or follow up to get this site assigned on Ultro before proceeding.</div>
            </div>
          </div>
        )}

        {/* WARNINGS */}
        {!na && missing.length > 0 && (
          <div className={styles.warnBox}>
            <div className={styles.warnTitle}>⚠ Earlier stages incomplete — update when available</div>
            <ul className={styles.warnList}>{missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
        )}

        {/* SITE DETAILS */}
        <SecHeader num="" label="Site Details" />
        <div className={styles.grid}>
          <Field label="Site ID"        value={p.site_id}   onChange={v => s('site_id', v)} />
          <Field label="Site Name"      value={p.site_name} onChange={v => s('site_name', v)} />
          <Field label="Zone"           value={p.zone}      onChange={v => s('zone', v)} />
          <Field label="City"           value={p.city}      onChange={v => s('city', v)} />
          <Field label="Circle"         value={p.circle}    onChange={v => s('circle', v)} />
          <Field label="Site Type"      value={p.site_type} onChange={v => s('site_type', v)} />
          <Field label="Toco / Tower Co" value={p.toco}    onChange={v => s('toco', v)} />
          <Field label="Layer"          value={p.layer}     onChange={v => s('layer', v)} />
        </div>

        {/* STAGE 1 — EMAIL */}
        <SecHeader num={1} label="Email Received" status={p.email_received_date ? 'done' : ''} />
        <div className={styles.grid}>
          <Field label="Email Received Date" value={p.email_received_date} onChange={v => s('email_received_date', v)} type="date" />
          <TextArea label="Email Content / Summary" value={p.email_content} onChange={v => s('email_content', v)} placeholder="Paste or summarise the email…" />
        </div>

        {/* STAGE 2 — ULTRO */}
        <SecHeader num={2} label="Listed & Assigned on Ultro" status={p.listed_on_ultro === 'Yes' ? 'done' : p.listed_on_ultro === 'No' ? 'warn' : ''} />
        <div className={styles.grid}>
          <YN label="Listed & Assigned on Ultro" value={p.listed_on_ultro} onChange={v => s('listed_on_ultro', v)} />
          {p.listed_on_ultro === 'No' && (
            <YN label="Email Sent to Client" value={p.email_sent_to_client} onChange={v => s('email_sent_to_client', v)} />
          )}
        </div>
        {p.listed_on_ultro === 'No' && (
          <div className={styles.naInline}>⚠ Not Assigned on Ultro — this card will show a red alert in all views</div>
        )}

        {/* STAGE 3 — TEAM */}
        <SecHeader num={3} label="Team Assigned" status={secStatus('team_assigned')} />
        <div className={styles.grid}>
          <YN label="Team Assigned" value={p.team_assigned} onChange={v => s('team_assigned', v)} />
          <Field label="Team Name"   value={p.team_name}   onChange={v => s('team_name', v)} placeholder="e.g. Team Alpha" />
          <Field label="Team Number" value={p.team_number} onChange={v => s('team_number', v)} placeholder="e.g. T-01" />
        </div>

        {/* STAGE 4 — WORK */}
        <SecHeader num={4} label="Work Initiated" status={secStatus('work_initiated')} />
        <div className={styles.grid}>
          <YN label="Work Initiated" value={p.work_initiated} onChange={v => s('work_initiated', v)} />
          <Field label="Work Date" value={p.work_date} onChange={v => s('work_date', v)} type="date" />
        </div>

        {/* STAGE 5 — TEAM PAYMENT */}
        <SecHeader num={5} label="Team Payment" status={p.advance_amount ? 'done' : ''} />
        <div className={styles.payCard}>
          <div className={styles.payTitle}>Advance Payment <span>paid after work initiation</span></div>
          <div className={styles.grid3}>
            <Field label="Amount (₹)" value={p.advance_amount} onChange={v => s('advance_amount', v)} placeholder="e.g. 8000" />
            <Field label="Payment Date" value={p.advance_date} onChange={v => s('advance_date', v)} type="date" />
            <ModeSelect label="Payment Mode" value={p.advance_mode} onChange={v => s('advance_mode', v)} />
          </div>
        </div>
        <div className={styles.payCard} style={{ marginTop: 8 }}>
          <div className={styles.payTitle}>Balance Payment <span>paid after completion</span></div>
          <div className={styles.grid3}>
            <Field label="Amount (₹)" value={p.balance_amount} onChange={v => s('balance_amount', v)} placeholder="e.g. 12000" />
            <Field label="Payment Date" value={p.balance_date} onChange={v => s('balance_date', v)} type="date" />
            <ModeSelect label="Payment Mode" value={p.balance_mode} onChange={v => s('balance_mode', v)} />
          </div>
        </div>

        {/* STAGE 6 — MATERIAL RECEIVED */}
        <SecHeader num={6} label="Material Received at MTNH Warehouse" status={secStatus('material_received')} />
        <div className={styles.grid}>
          <YN label="Material Received" value={p.material_received} onChange={v => s('material_received', v)} />
          <Field label="Receipt Date" value={p.material_received_date} onChange={v => s('material_received_date', v)} type="date" />
        </div>

        {/* STAGE 7 — PACKING */}
        <SecHeader num={7} label="Packing Done" status={secStatus('packing_done')} />
        <div className={styles.grid}>
          <YN label="Packing Done" value={p.packing_done} onChange={v => s('packing_done', v)} />
          <Field label="Packing Date" value={p.packing_date} onChange={v => s('packing_date', v)} type="date" />
          <PhotoUpload value={p.packing_photo_url} onChange={v => s('packing_photo_url', v)} siteId={p.site_id} />
        </div>

        {/* STAGE 8 — DC */}
        <SecHeader num={8} label="DC Received" status={secStatus('dc_received')} />
        <div className={styles.grid}>
          <YN label="DC Received" value={p.dc_received} onChange={v => s('dc_received', v)} />
          <Field label="DC Number" value={p.dc_number} onChange={v => s('dc_number', v)} placeholder="e.g. DC-2026-001" />
        </div>

        {/* STAGE 9 — SREQ */}
        <SecHeader num={9} label="SREQ Done" status={secStatus('sreq_done')} />
        <div className={styles.grid}>
          <YN label="SREQ Done" value={p.sreq_done} onChange={v => s('sreq_done', v)} />
          <Field label="SREQ Date"   value={p.sreq_date}   onChange={v => s('sreq_date', v)} type="date" />
          <Field label="SREQ Number" value={p.sreq_number} onChange={v => s('sreq_number', v)} placeholder="SREQ-XXXX" />
        </div>

        {/* STAGE 10 — MAT SUBMITTED */}
        <SecHeader num={10} label="Material Submitted at Partner Warehouse" status={secStatus('material_submitted')} />
        <div className={styles.grid}>
          <YN label="Material Submitted" value={p.material_submitted} onChange={v => s('material_submitted', v)} />
          <Field label="Submission Date" value={p.material_submitted_date} onChange={v => s('material_submitted_date', v)} type="date" />
        </div>

        {/* STAGE 11 — SIGNED DC */}
        <SecHeader num={11} label="Signed DC Received" status={secStatus('signed_dc_received')} />
        <div className={styles.grid}>
          <YN label="Signed DC Received" value={p.signed_dc_received} onChange={v => s('signed_dc_received', v)} />
          <Field label="Signed DC Date" value={p.signed_dc_date} onChange={v => s('signed_dc_date', v)} type="date" />
          <PdfUpload value={p.signed_dc_url} onChange={v => s('signed_dc_url', v)} siteId={p.site_id} />
        </div>

        {/* STAGE 12 — PO (flexible) */}
        <SecHeader num={12} label="PO Received" status="flex" />
        <div className={styles.grid}>
          <YN label="PO Received" value={p.po_received} onChange={v => s('po_received', v)} />
          <Field label="PO Date"   value={p.po_date}   onChange={v => s('po_date', v)} type="date" />
          <Field label="PO Number" value={p.po_number} onChange={v => s('po_number', v)} placeholder="PO-XXXX" />
        </div>

        {/* STAGE 13 — ULTRO TASKS */}
        <SecHeader num={13} label="All Ultro Tasks Done" status={secStatus('all_tasks_ultro')} />
        <div className={styles.grid}>
          <YN label="All Tasks Done" value={p.all_tasks_ultro} onChange={v => s('all_tasks_ultro', v)} />
          <TextArea label="Pending Tasks (if No)" value={p.pending_tasks} onChange={v => s('pending_tasks', v)} placeholder="List any tasks still pending…" />
        </div>

        {/* STAGE 14 — WCC */}
        <SecHeader num={14} label="WCC Received" status={p.wcc_received === 'Yes' ? 'done' : p.wcc_received === 'Pending' ? 'warn' : ''} />
        <div className={styles.grid}>
          <YN label="WCC Received" value={p.wcc_received} onChange={v => s('wcc_received', v)} hasPending />
          <Field label="WCC Date"   value={p.wcc_date}   onChange={v => s('wcc_date', v)} type="date" />
          <Field label="WCC Number" value={p.wcc_number} onChange={v => s('wcc_number', v)} placeholder="WCC-XXXX" />
          <Field label="Pending Reason" value={p.wcc_remark} onChange={v => s('wcc_remark', v)} placeholder="Why is WCC pending?" full />
        </div>

        {/* STAGE 15 — INVOICE */}
        <SecHeader num={15} label="Invoice Done" status={secStatus('invoice_done')} />
        <div className={styles.grid}>
          <YN label="Invoice Done" value={p.invoice_done} onChange={v => s('invoice_done', v)} />
          <Field label="Invoice Date"   value={p.invoice_date}   onChange={v => s('invoice_date', v)} type="date" />
          <Field label="Invoice Number" value={p.invoice_number} onChange={v => s('invoice_number', v)} placeholder="INV-XXXX" />
        </div>

        {/* STAGE 16 — PAYMENT */}
        <SecHeader num={16} label="Payment Received" status={secStatus('payment_received')} />
        <div className={styles.grid}>
          <YN label="Payment Received" value={p.payment_received} onChange={v => s('payment_received', v)} />
          <Field label="Payment Date"      value={p.payment_date}   onChange={v => s('payment_date', v)} type="date" />
          <Field label="Payment Amount (₹)" value={p.payment_amount} onChange={v => s('payment_amount', v)} placeholder="e.g. 45000" />
          <TextArea label="Closing Remarks" value={p.remarks} onChange={v => s('remarks', v)} placeholder="Any final notes…" />
        </div>
      </div>

      <div className={styles.footer}>
        {isEdit && <button className={styles.deleteBtn} onClick={() => onDelete(p.id)}>Delete Site</button>}
        <div style={{ flex: 1 }} />
        <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Site'}
        </button>
      </div>
    </div>
  )
}
