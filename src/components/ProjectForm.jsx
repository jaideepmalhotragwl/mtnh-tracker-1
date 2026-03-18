import { useState } from 'react'
import { newProject } from '../utils/stageLogic'
import styles from './ProjectForm.module.css'

function YesNo({ label, value, onChange, hasPending }) {
  const opts = hasPending ? ['Yes', 'No', 'Pending'] : ['Yes', 'No']
  return (
    <div className={styles.formGroup}>
      <label className={styles.label}>{label}</label>
      <div className={styles.toggleGroup}>
        {opts.map(o => (
          <button
            key={o}
            type="button"
            className={`${styles.toggleBtn} ${value === o ? (o === 'Yes' ? styles.tYes : o === 'No' ? styles.tNo : styles.tPending) : ''}`}
            onClick={() => onChange(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

function Field({ label, id, value, onChange, type = 'text', full }) {
  return (
    <div className={`${styles.formGroup} ${full ? styles.full : ''}`}>
      <label className={styles.label}>{label}</label>
      <input
        type={type}
        className={styles.input}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

function TextArea({ label, value, onChange }) {
  return (
    <div className={`${styles.formGroup} ${styles.full}`}>
      <label className={styles.label}>{label}</label>
      <textarea className={styles.textarea} value={value} onChange={e => onChange(e.target.value)} rows={3} />
    </div>
  )
}

export default function ProjectForm({ project, onSave, onDelete, onClose }) {
  const [p, setP] = useState(() => project ? { ...project } : newProject())

  const set = (k, v) => setP(prev => ({ ...prev, [k]: v }))

  function handleSave() {
    if (!p.siteName && !p.siteId) { alert('Please enter at least a Site Name or Site ID'); return }
    onSave(p)
  }

  const isEdit = !!project

  return (
    <div className={styles.modal}>
      <div className={styles.header}>
        <div>
          {isEdit && <div className={styles.subhead}>{p.siteId}</div>}
          <div className={styles.title}>{isEdit ? 'Update Site' : 'New Site'}</div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div className={styles.body}>
        <Section label="Site Details" />
        <div className={styles.grid}>
          <Field label="Site ID"        value={p.siteId}   onChange={v => set('siteId', v)} />
          <Field label="Site Name"      value={p.siteName} onChange={v => set('siteName', v)} />
          <Field label="Zone"           value={p.zone}     onChange={v => set('zone', v)} />
          <Field label="City"           value={p.city}     onChange={v => set('city', v)} />
          <Field label="Circle"         value={p.circle}   onChange={v => set('circle', v)} />
          <Field label="Site Type"      value={p.siteType} onChange={v => set('siteType', v)} />
          <Field label="Toco / Tower Co" value={p.toco}   onChange={v => set('toco', v)} />
          <Field label="Layer"          value={p.layer}    onChange={v => set('layer', v)} />
        </div>

        <Section label="Ultro & Team" />
        <div className={styles.grid}>
          <YesNo label="Listed on Ultro" value={p.listedOnUltro} onChange={v => set('listedOnUltro', v)} />
          <YesNo label="Team Assigned"   value={p.teamAssigned}  onChange={v => set('teamAssigned', v)} />
          <Field label="Team Name"       value={p.teamName}      onChange={v => set('teamName', v)} />
          <Field label="Team Number"     value={p.teamNumber}    onChange={v => set('teamNumber', v)} />
        </div>

        <Section label="Work & Installation" />
        <div className={styles.grid}>
          <YesNo label="Work Initiated"       value={p.workInitiated} onChange={v => set('workInitiated', v)} />
          <Field label="Work Completion Date" value={p.installDate}   onChange={v => set('installDate', v)} type="date" />
        </div>

        <Section label="Material" />
        <div className={styles.grid}>
          <YesNo label="Dispatched to MTNH Warehouse" value={p.materialDispatched} onChange={v => set('materialDispatched', v)} />
          <Field label="Dispatch Date" value={p.disDate} onChange={v => set('disDate', v)} type="date" />
          <TextArea label="Material Details" value={p.materialDetails} onChange={v => set('materialDetails', v)} />
          <YesNo label="Submitted to Client Warehouse" value={p.materialSubmitted} onChange={v => set('materialSubmitted', v)} />
          <Field label="Submission Date" value={p.matSubmitDate} onChange={v => set('matSubmitDate', v)} type="date" />
          <YesNo label="DC Received"  value={p.dcReceived} onChange={v => set('dcReceived', v)} />
          <Field label="DC Number"    value={p.dcNumber}   onChange={v => set('dcNumber', v)} />
        </div>

        <Section label="SREQ" />
        <div className={styles.grid}>
          <YesNo label="SREQ Done"  value={p.sreqDone}   onChange={v => set('sreqDone', v)} />
          <Field label="SREQ Date"  value={p.sreqDate}   onChange={v => set('sreqDate', v)} type="date" />
          <Field label="SREQ Number" value={p.sreqNumber} onChange={v => set('sreqNumber', v)} />
        </div>

        <Section label="Ultro Completion & WCC" />
        <div className={styles.grid}>
          <YesNo label="All Ultro Tasks Done" value={p.allTasksUltro} onChange={v => set('allTasksUltro', v)} />
          <TextArea label="Pending Tasks (if No)" value={p.pendingTasks} onChange={v => set('pendingTasks', v)} />
          <YesNo label="WCC Received" value={p.wccReceived} onChange={v => set('wccReceived', v)} hasPending />
          <Field label="WCC Date"     value={p.wccDate}     onChange={v => set('wccDate', v)} type="date" />
          <Field label="WCC Number"   value={p.wccNumber}   onChange={v => set('wccNumber', v)} />
          <Field label="WCC Pending Reason" value={p.wccRemark} onChange={v => set('wccRemark', v)} full />
        </div>

        <Section label="Invoice & Payment" />
        <div className={styles.grid}>
          <YesNo label="Invoice Done"    value={p.invoiceDone}     onChange={v => set('invoiceDone', v)} />
          <Field label="Invoice Date"    value={p.invoiceDate}     onChange={v => set('invoiceDate', v)} type="date" />
          <Field label="Invoice Number"  value={p.invoiceNumber}   onChange={v => set('invoiceNumber', v)} />
          <YesNo label="Payment Received" value={p.paymentReceived} onChange={v => set('paymentReceived', v)} />
          <Field label="Payment Date"    value={p.paymentDate}     onChange={v => set('paymentDate', v)} type="date" />
          <Field label="Payment Amount (₹)" value={p.paymentAmount} onChange={v => set('paymentAmount', v)} />
        </div>

        <Section label="Closing" />
        <div className={styles.grid}>
          <TextArea label="Closing Remarks" value={p.remarks} onChange={v => set('remarks', v)} />
        </div>
      </div>

      <div className={styles.footer}>
        {isEdit && (
          <button className={styles.deleteBtn} onClick={() => onDelete(p._id)}>Delete Site</button>
        )}
        <div style={{ flex: 1 }} />
        <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
        <button className={styles.saveBtn} onClick={handleSave}>Save Site</button>
      </div>
    </div>
  )
}

function Section({ label }) {
  return <div className={styles.section}>{label}</div>
}
