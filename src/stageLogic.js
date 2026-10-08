import { STAGES, stageByKey, ALLOWED_OUT_OF_ORDER, DATE_COLUMNS } from './constants'

// ─────────────────────────────────────────────────────────────────
// READING MESSY SPREADSHEET VALUES
// ─────────────────────────────────────────────────────────────────

const NOT_A_VALUE = new Set(['', '-', 'na', 'n/a', 'nat', 'nan', 'none', 'null', 'undefined'])

export function isYes(v) {
  if (v === true) return true
  if (v === null || v === undefined) return false
  const s = String(v).trim().toLowerCase()
  if (NOT_A_VALUE.has(s)) return false
  return ['yes', 'y', 'done', 'true', '1', 'complete', 'completed', 'received', 'ok'].includes(s)
}

// A date column in these sheets can hold almost anything — "Not Issue",
// a note about an antenna, a serial number. Anything that isn't a date
// becomes blank rather than crashing the import.
export function parseDate(v) {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return ''
    return v.toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  if (NOT_A_VALUE.has(s.toLowerCase())) return ''

  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(s)) {
    const [d, m, y] = s.split('/')
    return `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
    const [d, m, y] = s.split('-')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)

  // Text in a date column. Let it go rather than guess.
  if (/[a-zA-Z]/.test(s)) return ''

  const dt = new Date(s)
  if (!isNaN(dt.getTime()) && dt.getFullYear() > 2000 && dt.getFullYear() < 2100) {
    return dt.toISOString().slice(0, 10)
  }
  return ''
}

// ─────────────────────────────────────────────────────────────────
// WHERE A SITE SITS
// ─────────────────────────────────────────────────────────────────

export function stageDone(site, stage) {
  if (!site) return false
  if (stage.flag) return isYes(site[stage.flag])
  // A stage with no flag of its own is done when its date is filled.
  if (stage.key === 'email')   return !!site.email_received_date
  if (stage.key === 'teampay') return !!(site.advance_date || site.balance_date ||
                                         site.advance_amount || site.balance_amount)
  return false
}

// The furthest stage reached. A card sits in this column.
export function currentStage(site) {
  let last = null
  for (const s of STAGES) if (stageDone(site, s)) last = s
  return last || STAGES[0]
}

// The column a card belongs in: the stage after the furthest one
// finished — the work actually waiting to happen.
//
// Not "the first unfinished stage". These sheets are full of gaps: the
// email date is rarely recorded, Ultro listing often isn't ticked. With
// first-unfinished, a site whose material is already in the warehouse
// still sits in Email Received, and every card piles into column one.
// What matters is how far a site has got, not which boxes were skipped
// on the way — the gaps show up as flags on the card instead.
export function pendingStage(site) {
  let last = -1
  STAGES.forEach((s, i) => { if (stageDone(site, s)) last = i })
  if (last === -1) return STAGES[0]
  return STAGES[Math.min(last + 1, STAGES.length - 1)]
}

export function progressPct(site) {
  const done = STAGES.filter(s => stageDone(site, s)).length
  return Math.round((done / STAGES.length) * 100)
}

// ─────────────────────────────────────────────────────────────────
// WHAT'S WRONG WITH THIS SITE
//
// The old rule fired on 46 of 47 sites, so the badge told you
// nothing. This one only speaks up about things a person can act on.
// ─────────────────────────────────────────────────────────────────

function allowedGap(earlierKey, laterKey) {
  return ALLOWED_OUT_OF_ORDER.some(([a, b]) => a === earlierKey && b === laterKey)
}

export function siteIssues(site, evidence) {
  const out = []

  // Work has started but the site was never listed on Ultro. This is the
  // one that actually costs money — unlisted work does not get paid.
  if (stageDone(site, stageByKey.work) && !isYes(site.listed_on_ultro)) {
    out.push({ level: 'alert', text: 'Not listed on Ultro' })
  }

  // A stage ticked with nothing behind it.
  if (evidence && evidence.missing_evidence > 0) {
    out.push({
      level: 'alert',
      text: evidence.missing_evidence === 1
        ? '1 stage marked done, no file'
        : `${evidence.missing_evidence} stages marked done, no files`
    })
  }

  // A real jump: a later stage finished while an earlier one is still open,
  // and the pair isn't on the allowed list.
  const doneKeys = STAGES.filter(s => stageDone(site, s)).map(s => s.key)
  if (doneKeys.length) {
    const furthest = STAGES.findIndex(s => s.key === doneKeys[doneKeys.length - 1])
    for (let i = 0; i < furthest; i++) {
      const s = STAGES[i]
      if (stageDone(site, s)) continue
      if (s.key === 'email' || s.key === 'teampay') continue  // often just unrecorded
      const laterKey = STAGES[furthest].key
      if (allowedGap(s.key, laterKey)) continue
      out.push({ level: 'warn', text: `${STAGES[furthest].short} done but ${s.short} is open` })
      break  // one is enough; a list of twelve is noise
    }
  }

  // Invoiced a while ago and still unpaid.
  if (stageDone(site, stageByKey.invoice) && !stageDone(site, stageByKey.payment)) {
    const d = site.invoice_date ? new Date(site.invoice_date) : null
    if (d && !isNaN(d)) {
      const days = Math.floor((Date.now() - d.getTime()) / 86400000)
      if (days > 45) out.push({ level: 'warn', text: `Invoiced ${days} days ago, unpaid` })
    }
  }

  return out
}

// ─────────────────────────────────────────────────────────────────
// WRITING BACK
// ─────────────────────────────────────────────────────────────────

// Empty strings are fine for text but illegal for a date column, so they
// become null. Done here rather than in each form field.
export function cleanForWrite(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (DATE_COLUMNS.has(k)) out[k] = (v === '' || v === undefined) ? null : v
    else out[k] = v === undefined ? null : v
  }
  return out
}
