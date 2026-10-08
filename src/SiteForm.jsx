import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { STAGES } from './constants'
import { stageDone, isYes } from './stageLogic'
import { useApp } from './store'
import { useToast } from './Toast'
import { useSitePhotos } from './usePhotos'
import { normSiteId } from './useProjects'
import { useEscape } from './useEscape'
import UploadSlot from './UploadSlot'

// The four slots that did not exist before the redesign.
const NEW_SLOTS = new Set(['dismantling', 'material', 'dc_doc', 'handover'])

// ─────────────────────────────────────────────────────────────────
// The field components live out here, not inside SiteForm.
//
// Defined inside, each render would create a brand new component type,
// React would throw the old input away and mount a fresh one, and the
// cursor would jump out of the box after every single keystroke. A
// context carries the form state down instead.
// ─────────────────────────────────────────────────────────────────

const FormCtx = createContext(null)

function Txt({ k, label, ph, wide }) {
  const { f, set } = useContext(FormCtx)
  return (
    <div style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <label>{label}</label>
      <input value={f[k] ?? ''} placeholder={ph} onChange={e => set(k, e.target.value)} />
    </div>
  )
}

function Dt({ k, label }) {
  const { f, set } = useContext(FormCtx)
  return (
    <div>
      <label>{label}</label>
      <input type="date" value={f[k] ?? ''} onChange={e => set(k, e.target.value)} />
    </div>
  )
}

function YN({ k, label }) {
  const { f, set } = useContext(FormCtx)
  const v = f[k]
  return (
    <div>
      <label>{label}</label>
      <select value={isYes(v) ? 'Yes' : (v ? String(v) : '')}
              onChange={e => set(k, e.target.value)}>
        <option value="">—</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    </div>
  )
}

function Mode({ k, label }) {
  const { f, set } = useContext(FormCtx)
  return (
    <div>
      <label>{label}</label>
      <select value={f[k] ?? ''} onChange={e => set(k, e.target.value)}>
        <option value="">—</option>
        <option>UPI — company</option>
        <option>UPI — personal</option>
        <option>Bank transfer</option>
        <option>Cash</option>
      </select>
    </div>
  )
}

function Slot({ stageKey }) {
  const { stageByKey, savedSiteId, photos, reloadPhotos } = useContext(FormCtx)
  const st = stageByKey[stageKey]

  // No row in photo_stages for this stage. Say so rather than quietly
  // showing nothing — a missing upload box looks like a broken form.
  if (!st) return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div className="note warnN" style={{ margin: 0 }}>
        No upload slot configured for <b>{stageKey}</b>. Settings → Upload slots.
      </div>
    </div>
  )

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <UploadSlot
        stage={st}
        siteId={savedSiteId}
        photos={photos}
        onDone={reloadPhotos}
        isNew={NEW_SLOTS.has(stageKey)}
      />
      {!savedSiteId && (
        <div className="sm mut" style={{ marginTop: 6 }}>Save the site first, then upload.</div>
      )}
    </div>
  )
}

export default function SiteForm({ site, onClose, onSave, onDelete }) {
  const [f, setF] = useState(() => ({ ...site }))
  const [busy, setBusy] = useState(false)
  const { activeVendors, activePeople, stageByKey, me, isAdmin } = useApp()
  const toast = useToast()

  const siteId = normSiteId(f.site_id)
  const { photos, reload: reloadPhotos } = useSitePhotos(site.site_id ? siteId : null)

  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const isNewSite = !site.id

  useEscape(onClose)

  // A stage ticked with no file behind it. Shown here as well as on the
  // card, because this is where somebody can actually fix it.
  const missing = useMemo(() => {
    return STAGES.filter(s => {
      if (!s.photoStage) return false
      if (!stageDone(f, s)) return false
      if (photos.some(p => p.stage === s.photoStage)) return false
      // the old single-file fields still count as evidence
      if (s.photoStage === 'packing'   && f.packing_photo_url) return false
      if (s.photoStage === 'signed_dc' && f.signed_dc_url) return false
      return true
    })
  }, [f, photos])

  async function save() {
    if (!siteId) { toast('A site needs an ID.', 'bad'); return }
    setBusy(true)
    try {
      await onSave({ ...f, site_id: siteId, updated_by: me || f.updated_by || null })
      toast(isNewSite ? `${siteId} added.` : `${siteId} saved.`, 'good')
      onClose()
    } catch (err) {
      toast(err.message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${siteId}? This cannot be undone.`)) return
    try {
      await onDelete(site.id)
      toast(`${siteId} deleted.`)
      onClose()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  const ctx = {
    f, set, stageByKey, photos, reloadPhotos,
    savedSiteId: site.site_id ? siteId : null
  }

  return (
   <FormCtx.Provider value={ctx}>
    <div className="scrim" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-h">
          <h2>{isNewSite ? 'New site' : siteId}</h2>
          {f.vendor && <span className="tag v">{f.vendor}</span>}
          <button className="ghost right" onClick={onClose}>Close</button>
        </div>

        <div className="modal-b">
          {missing.length > 0 && (
            <div className="note warnN">
              <b>Marked done with no file:</b>{' '}
              {missing.map(s => s.label).join(' · ')}
              <div className="sm" style={{ marginTop: 4 }}>
                Allowed — but the card shows this, so the gap is visible to everyone.
              </div>
            </div>
          )}

          {/* ── identity ───────────────────────────────────────── */}
          <div className="fs">
            <div className="fs-h"><span className="no">•</span><b>Site</b></div>
            <div className="fs-b grid3">
              <div>
                <label>Site ID</label>
                <input className="mono" value={f.site_id ?? ''}
                       onChange={e => set('site_id', e.target.value.toUpperCase())} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label>Site name</label>
                <input value={f.site_name ?? ''} onChange={e => set('site_name', e.target.value)} />
              </div>
              <div>
                <label>Vendor</label>
                <select value={f.vendor ?? ''} onChange={e => set('vendor', e.target.value)}>
                  <option value="">—</option>
                  {activeVendors.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              </div>
              <Txt k="circle"    label="Circle" />
              <Txt k="site_type" label="Site type" />
              <Txt k="zone"      label="Zone" />
              <Txt k="city"      label="City" />
              <Txt k="district"  label="District" />
              <Txt k="layer"     label="Layer" />
              <Txt k="toco"      label="TOCO" />
              <Txt k="toco_id"   label="TOCO ID" />
              <Txt k="unique_id" label="Unique ID" />
              <Txt k="sector_id" label="Sector ID" />
              <Txt k="locator_id" label="Locator ID" />
              <Txt k="degrow_type" label="Degrow type" />
              <Txt k="lat"  label="Latitude" />
              <Txt k="long" label="Longitude" />
              <Txt k="partner" label="Partner" />
              <Txt k="dismantle_status" label="Dismantle status" />
              <Txt k="lock_status" label="Lock status" />
              <Txt k="ptw_no" label="PTW no." />
              <Txt k="tower_height"   label="Tower height" />
              <Txt k="antenna_height" label="Antenna height" />
            </div>
          </div>

          {/* ── the pipeline ───────────────────────────────────── */}
          {STAGES.map(st => (
            <div className="fs" key={st.key}>
              <div className={`fs-h ${stageDone(f, st) ? 'done' : ''}`}>
                <span className="no">{stageDone(f, st) ? '✓' : st.no}</span>
                <b>{st.label}</b>
                {st.photoStage && <span className="tag">upload</span>}
              </div>
              <div className="fs-b grid3">

                {st.key === 'email' && <>
                  <Dt k="email_received_date" label="Email received on" />
                  <Txt k="email_content" label="What the email said" wide />
                </>}

                {st.key === 'listed' && <>
                  <YN k="listed_on_ultro" label="Listed on Ultro" />
                  <YN k="email_sent_to_client" label="Email sent to client" />
                  {stageDone(f, STAGES[3]) && !isYes(f.listed_on_ultro) && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div className="note badN" style={{ margin: 0 }}>
                        Work has started and this site is not listed on Ultro. Unlisted
                        work does not get paid.
                      </div>
                    </div>
                  )}
                </>}

                {st.key === 'team' && <>
                  <YN k="team_assigned" label="Team assigned" />
                  <div>
                    <label>Team name</label>
                    <input list="people-list" value={f.team_name ?? ''}
                           onChange={e => set('team_name', e.target.value)} />
                    <datalist id="people-list">
                      {activePeople.map(p => <option key={p.name} value={p.name} />)}
                    </datalist>
                  </div>
                  <Txt k="team_number" label="Team contact" />
                </>}

                {st.key === 'work' && <>
                  <YN k="work_initiated" label="Work initiated" />
                  <Dt k="work_date" label="Work date" />
                  <Slot stageKey="dismantling" />
                </>}

                {st.key === 'teampay' && <>
                  <Txt  k="advance_amount" label="Advance ₹" />
                  <Dt   k="advance_date"   label="Advance paid on" />
                  <Mode k="advance_mode"   label="Advance mode" />
                  <Txt  k="balance_amount" label="Balance ₹" />
                  <Dt   k="balance_date"   label="Balance paid on" />
                  <Mode k="balance_mode"   label="Balance mode" />
                  <div style={{ gridColumn: '1 / -1' }} className="sm mut">
                    A split payment approved in the Team Room fills these in by itself.
                  </div>
                </>}

                {st.key === 'material' && <>
                  <YN k="material_received" label="Material received" />
                  <Dt k="material_received_date" label="Received on" />
                  <Slot stageKey="material" />
                  <div style={{ gridColumn: '1 / -1' }} className="sm b" >Hardware off the site</div>
                  <Txt k="ru_model" label="RU model" />
                  <Txt k="ru_serial_no" label="RU serial" />
                  <Txt k="rf_module_name" label="RF module" />
                  <Txt k="rf_module_serial" label="RF module serial" />
                  <Txt k="rf_module_qty" label="RF module qty" />
                  <Txt k="gsm_installed" label="GSM installed" />
                  <Txt k="gsm_dismantled" label="GSM dismantled" />
                  <Txt k="jumper_type" label="Jumper type" />
                  <Txt k="jumper_qty" label="Jumper qty" />
                  <Txt k="jumper_length" label="Jumper length" />
                  <Txt k="cpri_qty" label="CPRI qty" />
                  <Txt k="cpri_length" label="CPRI length" />
                  <Txt k="sfp_qty" label="SFP qty" />
                  <Txt k="power_cable_type" label="Power cable" />
                  <Txt k="power_cable_length" label="Power cable length" />
                  <Txt k="power_connector_qty" label="Power connector qty" />
                  <Txt k="fpka" label="Clamp / FPKA" />
                  <Txt k="clamp_details" label="Clamp details" />
                </>}

                {st.key === 'packing' && <>
                  <YN k="packing_done" label="Packing done" />
                  <Dt k="packing_date" label="Packed on" />
                  <Slot stageKey="packing" />
                </>}

                {st.key === 'dc' && <>
                  <YN  k="dc_received" label="DC received" />
                  <Txt k="dc_number"   label="DC number" />
                  <Slot stageKey="dc_doc" />
                </>}

                {st.key === 'sr' && <>
                  <YN  k="sr_done" label="SR done" />
                  <Txt k="sr_no"   label="SR number" />
                  <Dt  k="sr_date" label="SR date" />
                </>}

                {st.key === 'sreq' && <>
                  <YN  k="sreq_done"   label="SREQ done" />
                  <Txt k="sreq_number" label="SREQ number" />
                  <Dt  k="sreq_date"   label="SREQ date" />
                </>}

                {st.key === 'submitted' && <>
                  <YN k="material_submitted" label="Submitted at partner WH" />
                  <Dt k="material_submitted_date" label="Submitted on" />
                  <Slot stageKey="handover" />
                </>}

                {st.key === 'signeddc' && <>
                  <YN k="signed_dc_received" label="Signed DC received" />
                  <Dt k="signed_dc_date" label="Signed on" />
                  <Slot stageKey="signed_dc" />
                </>}

                {st.key === 'po' && <>
                  <YN  k="po_received" label="PO received" />
                  <Txt k="po_number"   label="PO number" />
                  <Dt  k="po_date"     label="PO date" />
                  <div style={{ gridColumn: '1 / -1' }} className="sm mut">
                    PO sometimes arrives before WCC. That order is fine and raises nothing.
                  </div>
                </>}

                {st.key === 'wcc' && <>
                  <YN  k="wcc_received" label="WCC received" />
                  <Txt k="wcc_number"   label="WCC number" />
                  <Dt  k="wcc_date"     label="WCC date" />
                  <Txt k="wcc_remark"   label="WCC remark" wide />
                </>}

                {st.key === 'invoice' && <>
                  <YN  k="invoice_done"   label="Invoice raised" />
                  <Txt k="invoice_number" label="Invoice number" />
                  <Dt  k="invoice_date"   label="Invoice date" />
                </>}

                {st.key === 'payment' && <>
                  <YN  k="payment_received" label="Payment received" />
                  <Txt k="payment_amount"   label="Amount ₹" />
                  <Dt  k="payment_date"     label="Received on" />
                </>}

              </div>
            </div>
          ))}

          {/* ── loose ends ─────────────────────────────────────── */}
          <div className="fs">
            <div className="fs-h"><span className="no">•</span><b>Notes</b></div>
            <div className="fs-b grid2">
              <YN  k="all_tasks_ultro" label="All tasks closed on Ultro" />
              <Txt k="billing_status"  label="Billing status" />
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Pending tasks</label>
                <textarea value={f.pending_tasks ?? ''} onChange={e => set('pending_tasks', e.target.value)} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Remarks</label>
                <textarea value={f.remarks ?? ''} onChange={e => set('remarks', e.target.value)} />
              </div>
            </div>
          </div>

          {f.updated_by && <div className="sm fnt">Last touched by {f.updated_by}</div>}
        </div>

        <div className="modal-f">
          <button className="pri" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : isNewSite ? 'Add site' : 'Save'}
          </button>
          <button onClick={onClose}>Cancel</button>
          {!isNewSite && isAdmin && (
            <button className="danger right" onClick={remove}>Delete</button>
          )}
        </div>
      </div>
    </div>
   </FormCtx.Provider>
  )
}
