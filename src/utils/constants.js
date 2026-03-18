export const STAGES = [
  { id: 'new',       label: 'Not on Ultro',   color: '#3730a3', bg: '#eef2ff' },
  { id: 'ultro',     label: 'Ultro Listed',   color: '#713f12', bg: '#fef9c3' },
  { id: 'team',      label: 'Team Assigned',  color: '#9a3412', bg: '#fff7ed' },
  { id: 'work',      label: 'Work Initiated', color: '#4c1d95', bg: '#ede9fe' },
  { id: 'material',  label: 'Material Sent',  color: '#064e3b', bg: '#d1fae5' },
  { id: 'sreq',      label: 'SREQ Done',      color: '#14532d', bg: '#ecfdf5' },
  { id: 'wcc',       label: 'WCC Stage',      color: '#581c87', bg: '#faf5ff' },
  { id: 'invoice',   label: 'Invoice Due',    color: '#881337', bg: '#fff1f2' },
  { id: 'done',      label: 'Completed',      color: '#14532d', bg: '#f0fdf4' },
]

export const STAGE_STEPS = [
  { key: 'listedOnUltro',      label: 'Listed on Ultro',              fields: [] },
  { key: 'teamAssigned',       label: 'Team Assigned',                fields: ['teamName', 'teamNumber'] },
  { key: 'workInitiated',      label: 'Work Initiated',               fields: ['installDate'] },
  { key: 'materialDispatched', label: 'Material Dispatched',          fields: ['disDate', 'materialDetails'] },
  { key: 'materialSubmitted',  label: 'Submitted to Client',          fields: ['matSubmitDate', 'dcReceived', 'dcNumber'] },
  { key: 'sreqDone',           label: 'SREQ Done',                    fields: ['sreqDate', 'sreqNumber'] },
  { key: 'allTasksUltro',      label: 'All Ultro Tasks Done',         fields: ['pendingTasks'] },
  { key: 'wccReceived',        label: 'WCC Received',                 fields: ['wccDate', 'wccNumber', 'wccRemark'], hasPending: true },
  { key: 'invoiceDone',        label: 'Invoice Done',                 fields: ['invoiceDate', 'invoiceNumber'] },
  { key: 'paymentReceived',    label: 'Payment Received',             fields: ['paymentDate', 'paymentAmount'] },
]

export const FIELD_LABELS = {
  teamName: 'Team Name', teamNumber: 'Team Number',
  installDate: 'Work Completion Date', disDate: 'Dispatch Date',
  materialDetails: 'Material Details', matSubmitDate: 'Submission Date',
  dcReceived: 'DC Received', dcNumber: 'DC Number',
  sreqDate: 'SREQ Date', sreqNumber: 'SREQ Number',
  pendingTasks: 'Pending Tasks', wccDate: 'WCC Date',
  wccNumber: 'WCC Number', wccRemark: 'WCC Pending Reason',
  invoiceDate: 'Invoice Date', invoiceNumber: 'Invoice Number',
  paymentDate: 'Payment Date', paymentAmount: 'Payment Amount (₹)',
}

export const SHEET_HEADERS = [
  'Site ID','Site Name','Zone','City','Circle','Site Type','Toco','Layer',
  'Listed on Ultro','Team Assigned','Team Name','Team Number',
  'Work Initiated','Work Date','Material Dispatched','Dispatch Date','Material Details',
  'Material Submitted','DC Received','DC Number',
  'SREQ Done','SREQ Date','SREQ Number',
  'All Ultro Tasks','WCC Received','WCC Date','WCC Number',
  'Invoice Done','Invoice Date','Invoice Number',
  'Payment Received','Payment Date','Payment Amount',
  'Remarks','Stage','Last Updated',
]

export const projectToRow = (p, getStageName) => [
  p.siteId, p.siteName, p.zone, p.city, p.circle, p.siteType, p.toco, p.layer,
  p.listedOnUltro, p.teamAssigned, p.teamName, p.teamNumber,
  p.workInitiated, p.installDate, p.materialDispatched, p.disDate, p.materialDetails,
  p.materialSubmitted, p.dcReceived, p.dcNumber,
  p.sreqDone, p.sreqDate, p.sreqNumber,
  p.allTasksUltro, p.wccReceived, p.wccDate, p.wccNumber,
  p.invoiceDone, p.invoiceDate, p.invoiceNumber,
  p.paymentReceived, p.paymentDate, p.paymentAmount,
  p.remarks, getStageName(p), new Date().toISOString(),
]
