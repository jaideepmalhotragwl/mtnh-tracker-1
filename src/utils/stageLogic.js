import { STAGES } from './constants'

export function getStage(p) {
  if (p.paymentReceived === 'Yes') return 'done'
  if (p.invoiceDone === 'Yes') return 'done'
  if (p.wccReceived === 'Yes' && p.invoiceDone !== 'Yes') return 'invoice'
  if ((p.allTasksUltro === 'Yes' || p.sreqDone === 'Yes') && p.wccReceived !== 'Yes') return 'wcc'
  if (p.materialSubmitted === 'Yes') return 'sreq'
  if (p.materialDispatched === 'Yes') return 'material'
  if (p.workInitiated === 'Yes') return 'work'
  if (p.teamAssigned === 'Yes') return 'team'
  if (p.listedOnUltro === 'Yes') return 'ultro'
  return 'new'
}

export function getStageMeta(p) {
  return STAGES.find(s => s.id === getStage(p)) || STAGES[0]
}

export function getStageIndex(p) {
  return STAGES.findIndex(s => s.id === getStage(p))
}

export function daysSince(d) {
  if (!d) return null
  const dt = new Date(d)
  return isNaN(dt) ? null : Math.floor((Date.now() - dt) / 86400000)
}

export function newProject(overrides = {}) {
  return {
    _id: 'P' + Date.now() + Math.random().toString(36).slice(2, 5),
    siteId: '', siteName: '', circle: '', siteType: '', toco: '',
    zone: '', city: '', district: '', layer: '', degrowPlan: '',
    bss: '', tech: '', partner: '',
    teamName: '', teamNumber: '',
    installDate: '', disDate: '', matReceivedDate: '',
    materialDetails: '', matSubmitDate: '', dcReceived: '', dcNumber: '',
    sreqDate: '', sreqNumber: '', pendingTasks: '',
    wccDate: '', wccNumber: '', wccRemark: '',
    invoiceDate: '', invoiceNumber: '',
    paymentDate: '', paymentAmount: '', remarks: '',
    listedOnUltro: '', teamAssigned: '', workInitiated: '',
    materialDispatched: '', materialSubmitted: '',
    sreqDone: '', allTasksUltro: '',
    wccReceived: '', invoiceDone: '', paymentReceived: '',
    billingStatus: '', invoiceNumberOrig: '',
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
    siteId:         get('site id', 'siteid'),
    siteName:       get('site name', 'sitename'),
    circle:         get('cir', 'circle'),
    siteType:       get('site type'),
    toco:           get('toco'),
    zone:           get('zone'),
    city:           get('city'),
    district:       get('district'),
    layer:          get('layer'),
    degrowPlan:     get('degrow plan'),
    bss:            get('bss'),
    tech:           get('tech'),
    partner:        get('partner'),
    teamName:       get('team name'),
    teamNumber:     get('team numb', 'team number'),
    installDate:    get('installation date'),
    disDate:        get('dis date'),
    matReceivedDate: get('mat. received date'),
    billingStatus:  get('billing status', 'billing status '),
    remarks:        get('remarks'),
    invoiceNumberOrig: get('invoice number'),
    teamAssigned:   get('team name') ? 'Yes' : 'No',
    workInitiated:  get('installation date') ? 'Yes' : 'No',
    materialDispatched: get('dis date') ? 'Yes' : 'No',
    wccReceived:    billing.includes('done') ? 'Yes' : '',
  })
}
