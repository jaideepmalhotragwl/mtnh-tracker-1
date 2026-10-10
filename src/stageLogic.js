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

const pad = n => String(n).padStart(2, '0')

// A real calendar date, or nothing. Month 25 must never reach the
// database — the whole import fails on it, and a silently wrong date is
// worse than a missing one.
function ymd(y, m, d) {
  if (!(y >= 1990 && y <= 2100)) return ''
  if (!(m >= 1 && m <= 12)) return ''
  if (!(d >= 1 && d <= 31)) return ''
  const probe = new Date(Date.UTC(y, m - 1, d))
  if (probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return ''  // 31 Feb
  return `${y}-${pad(m)}-${pad(d)}`
}

const DMY = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/

// Which way round a column writes its dates.
//
// 5/25/26 can only be month-first; 25/5/26 can only be day-first. Scan
// the whole column for a value that settles it and apply that to the
// ambiguous ones. Deciding per value would read 5/6 one way and 25/6 the
// other in the same column.
export function detectDateOrder(values) {
  let dmy = 0, mdy = 0
  for (const v of values) {
    if (v instanceof Date) continue
    const m = DMY.exec(String(v ?? '').trim())
    if (!m) continue
    const a = +m[1], b = +m[2]
    if (a > 12 && b <= 12) dmy++
    else if (b > 12 && a <= 12) mdy++
  }
  if (mdy > dmy) return 'mdy'
  if (dmy > mdy) return 'dmy'
  return null      // nothing in the column settles it
}

// A date column in these sheets can hold almost anything — "Not Issue",
// a note about an antenna, a serial number. Anything that isn't a date
// becomes blank rather than failing the import.
//
// `order` is what detectDateOrder worked out for this column. Without
// it, ambiguous values fall back to day-first, which is how the Indian
// sheets are written.
export function parseDate(v, order) {
  if (v === null || v === undefined) return ''

  // A date cell read as a serial number — the only form that means the
  // same thing in every timezone, which is why the importer asks for it.
  if (typeof v === 'number') return fromSerial(v)

  // A Date object, if one reaches us anyway. The spreadsheet library
  // hands back 23:59:50 on the day BEFORE when the browser is at +05:30,
  // so neither its local nor its UTC parts can be trusted: shift it to
  // local and snap to the nearest midnight before reading it.
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return ''
    const local = v.getTime() - v.getTimezoneOffset() * 60000
    const snapped = new Date(Math.round(local / 86400000) * 86400000)
    return ymd(snapped.getUTCFullYear(), snapped.getUTCMonth() + 1, snapped.getUTCDate())
  }

  const s = String(v).trim()
  if (NOT_A_VALUE.has(s.toLowerCase())) return ''

  // already the way the database wants it
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s)
  if (iso) return ymd(+iso[1], +iso[2], +iso[3])

  const m = DMY.exec(s)
  if (m) {
    const a = +m[1], b = +m[2]
    let y = +m[3]
    if (y < 100) y += 2000

    let day, mon
    if (a > 12 && b <= 12)      { day = a; mon = b }   // can only be day-first
    else if (b > 12 && a <= 12) { day = b; mon = a }   // can only be month-first
    else if (order === 'mdy')   { day = b; mon = a }
    else                        { day = a; mon = b }
    return ymd(y, mon, day)
  }

  // Text in a date column. Let it go rather than guess.
  if (/[a-zA-Z]/.test(s)) return ''

  // An Excel serial that arrived as text.
  if (/^\d{4,5}(\.\d+)?$/.test(s)) return fromSerial(Number(s))

  return ''
}

// Excel day number to a calendar date. Pure arithmetic in UTC, so the
// answer does not depend on where the person running the import is.
// Day 1 is 1 Jan 1900, and Excel wrongly believes 1900 was a leap year,
// which is why the epoch is 30 Dec 1899.
function fromSerial(serial) {
  const n = Math.round(Number(serial))
  if (!(n > 20000 && n < 60000)) return ''      // outside ~1954 to ~2064
  const dt = new Date(Date.UTC(1899, 11, 30) + n * 86400000)
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
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
