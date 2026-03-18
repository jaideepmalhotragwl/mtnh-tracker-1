import { useState } from 'react'
import { STAGE_STEPS, FIELD_LABELS } from '../utils/constants'
import { getStage, getStageMeta, getStageIndex } from '../utils/stageLogic'
import { STAGES } from '../utils/constants'
import styles from './FieldView.module.css'

export default function FieldView({ projects, onUpdate, onFullEdit }) {
  const [selected, setSelected] = useState(null)
  const [activeStep, setActiveStep] = useState(null)

  const project = projects.find(p => p._id === selected)

  if (activeStep !== null && project) {
    return (
      <QuickUpdate
        project={project}
        stepIndex={activeStep}
        onSave={(data) => { onUpdate(project._id, data); setActiveStep(null) }}
        onBack={() => setActiveStep(null)}
      />
    )
  }

  if (selected && project) {
    return (
      <ProjectStages
        project={project}
        onStepClick={setActiveStep}
        onBack={() => setSelected(null)}
        onFullEdit={() => { onFullEdit(project._id); setSelected(null) }}
      />
    )
  }

  return (
    <div className={styles.listWrap}>
      <p className={styles.hint}>Tap a site to update its current stage</p>
      {projects.length === 0 && (
        <div className={styles.empty}>No projects yet</div>
      )}
      {projects.map(p => {
        const meta = getStageMeta(p)
        return (
          <div key={p._id} className={styles.siteRow} onClick={() => setSelected(p._id)}>
            <div className={styles.siteInfo}>
              <div className={styles.siteName}>{p.siteName || 'Unnamed Site'}</div>
              <div className={styles.siteMeta}>{p.siteId || '—'} · {p.zone || '—'}</div>
            </div>
            <span className={styles.stagePill} style={{ background: meta.bg, color: meta.color }}>
              {meta.label}
            </span>
            <span className={styles.chevron}>›</span>
          </div>
        )
      })}
    </div>
  )
}

function ProjectStages({ project: p, onStepClick, onBack, onFullEdit }) {
  const stageIdx = getStageIndex(p)
  const pct = Math.round((stageIdx / (STAGES.length - 1)) * 100)

  return (
    <div className={styles.stagesWrap}>
      <div className={styles.stagesHeader}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <div className={styles.stagesTitle}>{p.siteName || 'Unnamed Site'}</div>
        <button className={styles.fullEditBtn} onClick={onFullEdit}>Full Edit</button>
      </div>

      <div className={styles.progressCard}>
        <div className={styles.progressTop}>
          <span className={styles.stageName}>{getStageMeta(p).label}</span>
          <span className={styles.pct}>{pct}%</span>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
        <div className={styles.siteMetaSmall}>{p.siteId || '—'} · {p.zone || '—'} · {p.teamName || 'No team'}</div>
      </div>

      <div className={styles.stepsList}>
        {STAGE_STEPS.map((step, i) => {
          const val = p[step.key]
          const done = val === 'Yes'
          const prevDone = i === 0 || p[STAGE_STEPS[i - 1]?.key] === 'Yes'
          const isCurrent = !done && prevDone

          return (
            <div
              key={step.key}
              className={`${styles.stepRow} ${done ? styles.stepDone : isCurrent ? styles.stepActive : styles.stepLocked}`}
              onClick={() => onStepClick(i)}
            >
              <div className={`${styles.stepIcon} ${done ? styles.iconDone : isCurrent ? styles.iconActive : styles.iconLocked}`}>
                {done ? '✓' : isCurrent ? '→' : '○'}
              </div>
              <div className={styles.stepInfo}>
                <div className={styles.stepLabel}>{step.label}</div>
                <div className={styles.stepDetail}>
                  {done
                    ? (step.fields[0] && p[step.fields[0]] ? p[step.fields[0]] : 'Completed')
                    : val === 'Pending' ? '⏳ Pending'
                    : isCurrent ? 'Tap to update'
                    : '—'}
                </div>
              </div>
              <span className={styles.chevron}>›</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function QuickUpdate({ project: p, stepIndex, onSave, onBack }) {
  const step = STAGE_STEPS[stepIndex]
  const [vals, setVals] = useState(() => {
    const init = { [step.key]: p[step.key] || '' }
    step.fields.forEach(f => { init[f] = p[f] || '' })
    return init
  })

  function set(k, v) { setVals(prev => ({ ...prev, [k]: v })) }

  function handleSave() { onSave(vals) }

  const yesNoOpts = step.hasPending ? ['Yes', 'No', 'Pending'] : ['Yes', 'No']

  return (
    <div className={styles.quickWrap}>
      <div className={styles.quickHeader}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <div className={styles.quickTitle}>{step.label}</div>
      </div>

      <div className={styles.quickBody}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Status</label>
          <div className={styles.toggleGroup}>
            {yesNoOpts.map(opt => (
              <button
                key={opt}
                className={`${styles.toggleBtn} ${vals[step.key] === opt ? (opt === 'Yes' ? styles.tYes : opt === 'No' ? styles.tNo : styles.tPending) : ''}`}
                onClick={() => set(step.key, opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {step.fields.map(f => {
          if (f === 'dcReceived') {
            return (
              <div key={f} className={styles.formGroup}>
                <label className={styles.label}>{FIELD_LABELS[f] || f}</label>
                <div className={styles.toggleGroup}>
                  {['Yes', 'No'].map(opt => (
                    <button
                      key={opt}
                      className={`${styles.toggleBtn} ${vals[f] === opt ? (opt === 'Yes' ? styles.tYes : styles.tNo) : ''}`}
                      onClick={() => set(f, opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )
          }
          const isDate = f.toLowerCase().includes('date')
          const isArea = f === 'materialDetails' || f === 'pendingTasks'
          return (
            <div key={f} className={styles.formGroup}>
              <label className={styles.label}>{FIELD_LABELS[f] || f}</label>
              {isArea
                ? <textarea className={styles.textarea} value={vals[f]} onChange={e => set(f, e.target.value)} rows={3} />
                : <input type={isDate ? 'date' : 'text'} className={styles.input} value={vals[f]} onChange={e => set(f, e.target.value)} />
              }
            </div>
          )
        })}
      </div>

      <div className={styles.quickFooter}>
        <button className={styles.cancelBtn} onClick={onBack}>Cancel</button>
        <button className={styles.saveBtn} onClick={handleSave}>Save</button>
      </div>
    </div>
  )
}
