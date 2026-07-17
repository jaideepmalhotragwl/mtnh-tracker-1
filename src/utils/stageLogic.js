import { STAGES } from './constants'

// Determine which Kanban column a project belongs to (furthest completed stage)
export function getStage(p) {
  if (p.payment_received === 'Yes') return 'done'
  if (p.invoice_done === 'Yes') return 'done'
  if (p.wcc_received === 'Yes' && p.invoice_done !== 'Yes') return 'invoice'
  if (p.wcc_received === 'Pending' || p.all_tasks_ultro === 'Yes') return 'wcc'
  if (p.po_received === 'Yes') return 'po'
  if (p.signed_dc_received === 'Yes') return 'signdc'
  if (p.material_submitted === 'Yes') return 'matsub'
  if (p.sreq_done === 'Yes') return 'sreq'
  if (p.dc_received === 'Yes') return 'dc'
  if (p.packing_done === 'Yes') return 'packing'
  if (p.material_received === 'Yes') return 'matrcv'
  if (p.advance_amount || p.balance_amount) return 'tpay'
  if (p.work_initiated === 'Yes') return 'work'
  if (p.team_assigned === 'Yes') return 'team'
  if (p.listed_on_ultro === 'Yes' || p.listed_on_ultro === 'No') return 'ultro'
  if (p.email_received_date) return 'email'
  return 'email'
}

export function getStageMeta(p) {
  return STAGES.find(s => s.id === getStage(p)) || STAGES[0]
}

export function getStageIndex(p) {
  return STAGES.findIndex(s => s.id === getStage(p))
}

// Check if site is "not assigned on Ultro"
export function isNotAssigned(p) {
  return p.listed_on_ultro === 'No'
}

// Find which earlier stages are missing/incomplete
export function getMissingStages(p) {
  const missing = []
  const stage = getStage(p)
  const stageIdx = STAGES.findIndex(s => s.id === stage)
  if (stageIdx <= 0) return missing

  if (!p.email_received_date && stageIdx > 0) missing.push('Email date not recorded')
  if (!p.listed_on_ultro && stageIdx > 1) missing.push('Listed & Assigned on Ultro — not done')
  if (!p.team_assigned && stageIdx > 2) missing.push('Team not assigned')
  if (!p.work_initiated && stageIdx > 3) missing.push('Work initiation not recorded')
  if (!p.advance_amount && stageIdx > 4) missing.push('Team advance payment not recorded')
  if (!p.material_received && stageIdx > 5) missing.push('Material receipt not recorded')
  if (!p.packing_done && stageIdx > 6) missing.push('Packing not marked done')
  if (!p.packing_photo_url && p.packing_done === 'Yes') missing.push('Packing photo not uploaded')
  if (!p.dc_received && stageIdx > 7) missing.push('DC not received')
  if (!p.sreq_done && stageIdx > 8) missing.push('SREQ not done')
  if (!p.material_submitted && stageIdx > 9) missing.push('Material submission not recorded')
  if (!p.signed_dc_received && stageIdx > 10) missing.push('Signed DC not received')

  return missing
}

export function daysSince(d) {
  if (!d) return null
  const dt = new Date(d)
  return isNaN(dt) ? null : Math.floor((Date.now() - dt) / 86400000)
}

export function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt)) return d
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function newProject(overrides = {}) {
  return {
    site_id: '', site_name: '', circle: '', site_type: '', toco: '',
    zone: '', city: '', district: '', layer: '',
    email_received_date: '', email_content: '',
    listed_on_ultro: '', email_sent_to_client: '',
    team_assigned: '', team_name: '', team_number: '',
    work_initiated: '', work_date: '',
    advance_amount: '', advance_date: '', advance_mode: '',
    balance_amount: '', balance_date: '', balance_mode: '',
    material_received: '', material_received_date: '',
    packing_done: '', packing_date: '', packing_photo_url: '',
    dc_received: '', dc_number: '',
    sreq_done: '', sreq_date: '', sreq_number: '',
    material_submitted: '', material_submitted_date: '',
    signed_dc_received: '', signed_dc_date: '', signed_dc_url: '',
    po_received: '', po_date: '', po_number: '',
    all_tasks_ultro: '', pending_tasks: '',
    wcc_received: '', wcc_date: '', wcc_number: '', wcc_remark: '',
    invoice_done: '', invoice_date: '', invoice_number: '',
    payment_received: '', payment_date: '', payment_amount: '', remarks: '',
    billing_status: '',
    ...overrides,
  }
}

export function mapExcelRow(r) {
  const get = (...keys) => {
    for (const k of keys) {
      for (const rk of Object.keys(r)) {
        if (rk.toLowerCase().trim() === k.toLowerCase().trim()) {
          const v = r[rk]
          return v == null ? '' : String(v).trim()
        }
      }
    }
    return ''
  }
  const billing = get('billing status', 'billing status ').toLowerCase()
  return newProject({
    site_id:        get('site id', 'siteid'),
    site_name:      get('site name', 'sitename'),
    circle:         get('cir', 'circle'),
    site_type:      get('site type'),
    toco:           get('toco'),
    zone:           get('zone'),
    city:           get('city'),
    district:       get('district'),
    layer:          get('layer'),
    team_name:      get('team name'),
    team_number:    get('team numb', 'team number'),
    work_date:      get('installation date'),
    dis_date:       get('dis date'),
    remarks:        get('remarks'),
    billing_status: get('billing status', 'billing status '),
    team_assigned:  get('team name') ? 'Yes' : '',
    work_initiated: get('installation date') ? 'Yes' : '',
    wcc_received:   billing.includes('done') ? 'Yes' : '',
  })
}
