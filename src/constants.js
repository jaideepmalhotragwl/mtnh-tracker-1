// ─────────────────────────────────────────────────────────────────
// THE PIPELINE
//
// Sixteen stages. A stage is "done" when its flag reads Yes.
// photoStage points at a row in the photo_stages table — those are
// the stages that take an upload, and uploading there ticks the
// flag from inside the database. See mtnh_setup.sql section 12.
// ─────────────────────────────────────────────────────────────────

export const STAGES = [
  { key: 'email',     no: 1,  label: 'Email Received',   short: 'Email',     flag: null,                 dateField: 'email_received_date', colour: '#6b7280' },
  { key: 'listed',    no: 2,  label: 'Listed & Assigned', short: 'Listed',   flag: 'listed_on_ultro',    dateField: null,                  colour: '#6b7280' },
  { key: 'team',      no: 3,  label: 'Team Assigned',    short: 'Team',      flag: 'team_assigned',      dateField: null,                  colour: '#0e7490' },
  { key: 'work',      no: 4,  label: 'Work Initiated',   short: 'Work',      flag: 'work_initiated',     dateField: 'work_date',           colour: '#0e7490', photoStage: 'dismantling' },
  { key: 'teampay',   no: 5,  label: 'Team Payment',     short: 'Team pay',  flag: null,                 dateField: 'advance_date',        colour: '#6d28d9' },
  { key: 'material',  no: 6,  label: 'Mat. Received',    short: 'Material',  flag: 'material_received',  dateField: 'material_received_date', colour: '#c27803', photoStage: 'material' },
  { key: 'packing',   no: 7,  label: 'Packing Done',     short: 'Packing',   flag: 'packing_done',       dateField: 'packing_date',        colour: '#c27803', photoStage: 'packing' },
  { key: 'dc',        no: 8,  label: 'DC Received',      short: 'DC',        flag: 'dc_received',        dateField: null,                  colour: '#c27803', photoStage: 'dc_doc' },
  { key: 'sr',        no: 9,  label: 'SR',               short: 'SR',        flag: 'sr_done',            dateField: 'sr_date',             colour: '#ea580c' },
  { key: 'sreq',      no: 10, label: 'SREQ',             short: 'SREQ',      flag: 'sreq_done',          dateField: 'sreq_date',           colour: '#ea580c' },
  { key: 'submitted', no: 11, label: 'Mat. Submitted',   short: 'Submitted', flag: 'material_submitted', dateField: 'material_submitted_date', colour: '#ea580c', photoStage: 'handover' },
  { key: 'signeddc',  no: 12, label: 'Signed DC',        short: 'Signed DC', flag: 'signed_dc_received', dateField: 'signed_dc_date',      colour: '#1a56db', photoStage: 'signed_dc' },
  { key: 'po',        no: 13, label: 'PO Received',      short: 'PO',        flag: 'po_received',        dateField: 'po_date',             colour: '#1a56db' },
  { key: 'wcc',       no: 14, label: 'WCC Received',     short: 'WCC',       flag: 'wcc_received',       dateField: 'wcc_date',            colour: '#1a56db' },
  { key: 'invoice',   no: 15, label: 'Invoice',          short: 'Invoice',   flag: 'invoice_done',       dateField: 'invoice_date',        colour: '#057a55' },
  { key: 'payment',   no: 16, label: 'Payment',          short: 'Payment',   flag: 'payment_received',   dateField: 'payment_date',        colour: '#057a55' }
]

export const stageByKey = Object.fromEntries(STAGES.map(s => [s.key, s]))

// PO sometimes turns up before WCC, and work sometimes happens before a
// site is listed on Ultro. These pairs are allowed to run out of order
// without raising anything.
export const ALLOWED_OUT_OF_ORDER = [
  ['po', 'wcc'],
  ['sr', 'sreq'],
  ['listed', 'team'],
  ['listed', 'work']
]

// ─────────────────────────────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────────────────────────────

export const PAY_CATEGORIES = [
  { key: 'team_advance', label: 'Team advance',  needsSite: true  },
  { key: 'team_balance', label: 'Team balance',  needsSite: true  },
  { key: 'shipping',     label: 'Shipping',      needsSite: false },
  { key: 'site_expense', label: 'Site expense',  needsSite: true  },
  { key: 'travel',       label: 'Travel & fuel', needsSite: false },
  { key: 'office',       label: 'Office & misc', needsSite: false }
]

export const PAY_MODES = ['UPI — company', 'UPI — personal', 'Bank transfer', 'Cash']

// ─────────────────────────────────────────────────────────────────
// COLUMNS THAT EXIST IN THE DATABASE
//
// Anything not on this list gets stripped before a write. That is
// what stops a stray field from turning into a 400 on save.
// Keep it in step with mtnh_setup.sql.
// ─────────────────────────────────────────────────────────────────

export const ALLOWED_COLUMNS = [
  'site_id', 'site_name', 'vendor', 'circle', 'site_type', 'toco', 'zone',
  'city', 'district', 'layer', 'team_name', 'team_number',
  'email_received_date', 'email_content', 'listed_on_ultro',
  'email_sent_to_client', 'team_assigned', 'work_initiated', 'work_date',
  'advance_amount', 'advance_date', 'advance_mode',
  'balance_amount', 'balance_date', 'balance_mode',
  'material_received', 'material_received_date',
  'packing_done', 'packing_date', 'packing_photo_url',
  'dc_received', 'dc_number',
  'sr_done', 'sr_no', 'sr_date',
  'sreq_done', 'sreq_date', 'sreq_number',
  'material_submitted', 'material_submitted_date',
  'signed_dc_received', 'signed_dc_date', 'signed_dc_url',
  'po_received', 'po_date', 'po_number',
  'all_tasks_ultro', 'pending_tasks',
  'wcc_received', 'wcc_date', 'wcc_number', 'wcc_remark',
  'invoice_done', 'invoice_date', 'invoice_number',
  'payment_received', 'payment_date', 'payment_amount',
  'remarks', 'billing_status', 'source_sheet', 'updated_by',
  // site identity, from the DPR sheet
  'toco_id', 'unique_id', 'sector_id', 'locator_id', 'degrow_type',
  'lat', 'long', 'partner', 'dismantle_status', 'lock_status', 'ptw_no',
  // hardware, filled when material is received
  'ru_model', 'ru_serial_no', 'rf_module_name', 'rf_module_serial',
  'rf_module_qty', 'gsm_installed', 'gsm_dismantled',
  'jumper_type', 'jumper_qty', 'jumper_length',
  'cpri_qty', 'cpri_length', 'sfp_qty',
  'power_cable_type', 'power_cable_length', 'power_connector_qty',
  'fpka', 'tower_height', 'antenna_height', 'clamp_details'
]

export const DATE_COLUMNS = new Set([
  'email_received_date', 'work_date', 'advance_date', 'balance_date',
  'material_received_date', 'packing_date', 'sr_date', 'sreq_date',
  'material_submitted_date', 'signed_dc_date', 'po_date', 'wcc_date',
  'invoice_date', 'payment_date'
])

// Fallbacks only. The real lists come from the vendors, room_users and
// photo_stages tables so Settings can change them without a deploy.
export const FALLBACK_VENDORS = ['RV', 'UST', 'Prose', 'Ariel']
export const FALLBACK_PEOPLE  = ['Jaideep', 'Mohit', 'Deepak', 'Vijay', 'Himanshu', 'Anuj', 'Neha']
