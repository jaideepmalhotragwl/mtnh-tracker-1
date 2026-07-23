import { STAGES } from './constants'

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

export function isNotAssigned(p) {
  return p.listed_on_ultro === 'No'
}

export function getMissingStages(p) {
  const missing = []
  const stageIdx = getStageIndex(p)
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
  if (isNaN(dt)) return String(d)
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function newProject(overrides = {}) {
  return {
    site_id: '', site_name: '', circle: '', site_type: '', toco: '',
    zone: '', city: '', district: '', layer: '', toco_id: '',
    lat: '', long: '', degrow_plan: '',
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
    billing_status: '', source_sheet: '',
    ...overrides,
  }
}

// Convert any date value from Excel to YYYY-MM-DD string
// Safely ignores text values like "Not Issue", "Done", remarks etc.
function parseDate(v) {
  if (!v || v === 'NaT' || v === 'nan' || v === '-') return ''
  // Already a JS Date object
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return ''
    return v.toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  if (!s || s === 'NaT' || s === 'nan' || s === '-') return ''
  // DD/MM/YY  e.g. 15/10/24
  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(s)) {
    const [d, m, y] = s.split('/')
    return `20${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  // DD/MM/YYYY  e.g. 30/11/2024
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/')
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  // YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  // If string contains letters/words (e.g. "Not Issue", remarks) — skip it
  if (/[a-zA-Z]/.test(s)) return ''
  // Try native parse as last resort for numeric formats
  const dt = new Date(s)
  if (!isNaN(dt.getTime()) && dt.getFullYear() > 2000) return dt.toISOString().slice(0, 10)
  return ''
}

// Flexible column getter — tries multiple name variants, case-insensitive
function makeGetter(row) {
  const keys = Object.keys(row)
  return (...names) => {
    for (const name of names) {
      const n = name.toLowerCase().trim()
      for (const k of keys) {
        if (k.toLowerCase().trim() === n) {
          const v = row[k]
          if (v == null || v === '' || (typeof v === 'number' && isNaN(v))) return ''
          const s = String(v).trim()
          if (s === 'NaT' || s === 'nan' || s === 'None') return ''
          return s
        }
      }
    }
    return ''
  }
}

export function mapExcelRow(row) {
  const get = makeGetter(row)

  // Site details — handle all sheet variants
  const siteId   = get('site id', 'site', 'siteid', 'site id.1')
  const siteName = get('site name', 'sitename')
  const circle   = get('cir', 'circle')
  const zone     = get('zone', 'cluster name')
  const city     = get('city', 'town', 'town name')
  const district = get('district')
  const layer    = get('layer', 'cir_layer')
  const siteType = get('site type', 'degrow type', 'degrow plan')
  const toco     = get('toco')
  const tocoId   = get('toco id', 'indus id')
  const lat      = get('lat', 'lat ')
  const long_    = get('long', 'log', 'long ')
  const partner  = get('partner')
  const degrow   = get('degrow plan', 'degrow type', 'activity')

  // Team — BSS = field engineer name, Team Name = supervisor
  const teamName   = get('team name', 'bss', 'bss name ', 'bss name')
  const teamNumber = get('team numb', 'no', 'bss no.', 'no.', 'team number')

  // Dates
  const workDate    = parseDate(get('installation date', 'dismantle date') || row['Installation Date'] || row['Dismantle Date'])
  const matDate     = parseDate(get('mat. received date', 'receivedmat. date ', 'mat received date', 'mat. received date.1') || row['Mat. Received Date'] || row['ReceivedMat. Date '])
  const disDate     = parseDate(get('dis date') || row['Dis Date'])
  const sreqDate    = parseDate(get('sreq date', 'sreq date ') || row['SREQ Date'] || row['SREQ DATE'])
  const matSubDate  = parseDate(get('material submission date', 'mat submission date ', 'material submitted date') || row['Material Submission Date'] || row['Mat Submission Date '])
  const srDate      = parseDate(get('sr date') || row['SR Date'])

  // Other fields
  const sreqNum    = get('sreq no', 'sreq number', 'sreq no.', 'sreq')
  const remarks    = get('remarks', 'remarks ', 'remarks-2', 'remarks.1')
  const payment    = get('payment', 'billing status', 'billing status ')
  const dcField    = get('dc')
  const matSub     = get('material submission wh', 'mat submission', 'submission status')

  // Derive stage flags from data
  // Payment can be 'Done', a number like 500/700 (amount paid), or blank
  const billing = payment.toLowerCase()
  const isDone  = billing === 'done' || billing.includes('done')
  const isPaid  = isDone || (!isNaN(Number(payment)) && Number(payment) > 0)

  return newProject({
    site_id:   siteId,
    site_name: siteName,
    circle,
    site_type: siteType,
    toco,
    toco_id:   tocoId,
    zone,
    city,
    district,
    layer,
    lat,
    long:      long_,
    degrow_plan: degrow,
    team_name:   teamName,
    team_number: teamNumber,
    work_date:   workDate,
    material_received_date: matDate,
    sreq_date:   sreqDate,
    sreq_number: sreqNum,
    material_submitted_date: matSubDate,
    remarks,
    billing_status: payment,

    // Auto-derive flags
    team_assigned:      teamName ? 'Yes' : '',
    work_initiated:     workDate ? 'Yes' : '',
    material_received:  matDate  ? 'Yes' : '',
    sreq_done:          sreqNum || sreqDate ? 'Yes' : '',
    material_submitted: matSubDate || matSub ? 'Yes' : '',
    dc_received:        dcField && dcField !== 'NaN' && dcField !== '-' ? 'Yes' : '',
    wcc_received:       isDone ? 'Yes' : '',
    payment_received:   isPaid ? 'Yes' : '',
    payment_amount:     isPaid && !isDone ? payment : '',
  })
}
