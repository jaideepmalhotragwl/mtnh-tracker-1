import { useState } from 'react'
import * as XLSX from 'xlsx'
import { parseDate } from './stageLogic'
import { useApp, resolveVendor } from './store'
import { useToast } from './Toast'
import { useEscape } from './useEscape'

// ─────────────────────────────────────────────────────────────────
// EXCEL IMPORT
//
// Seven vendors send seven differently shaped sheets. Matching is done
// on a squashed version of the header — lowercase, punctuation and all
// whitespace removed — so "Mat. Received Date", "MAT RECEIVED DATE"
// and "Material  Received Date" all land on the same column.
// ─────────────────────────────────────────────────────────────────

const squash = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Each entry: the database column, then every header spelling seen so far.
const MAP = [
  ['site_id',                 ['siteid', 'sitecode', 'site', 'siteidno', 'towerid']],
  ['site_name',               ['sitename', 'name', 'towername']],
  ['vendor',                  ['vendor', 'vendorname', 'client', 'customer', 'partnername']],
  ['circle',                  ['circle']],
  ['site_type',               ['sitetype', 'type']],
  ['toco',                    ['toco']],
  ['toco_id',                 ['tocoid', 'tocositeid']],
  ['unique_id',               ['uniqueid', 'uid']],
  ['sector_id',               ['sectorid', 'sector']],
  ['locator_id',              ['locatorid', 'locator']],
  ['degrow_type',             ['degrowtype', 'degrow']],
  ['zone',                    ['zone']],
  ['city',                    ['city', 'town']],
  ['district',                ['district', 'dist']],
  ['layer',                   ['layer']],
  ['lat',                     ['lat', 'latitude']],
  ['long',                    ['long', 'longitude', 'lng']],
  ['partner',                 ['partner']],
  ['dismantle_status',        ['dismantlestatus', 'dismantlingstatus']],
  ['lock_status',             ['lockstatus', 'lock']],
  ['ptw_no',                  ['ptwno', 'ptw', 'ptwnumber']],
  ['team_name',               ['teamname', 'team', 'vendorteam']],
  ['team_number',             ['teamnumber', 'teamno', 'teamcontact', 'contactno', 'mobile']],
  ['email_received_date',     ['emailreceiveddate', 'emaildate', 'receiveddate']],
  ['listed_on_ultro',         ['listedonultro', 'ultrolisted', 'ultro', 'listed']],
  ['team_assigned',           ['teamassigned', 'assigned']],
  ['work_initiated',          ['workinitiated', 'workstarted', 'dismantled']],
  ['work_date',               ['workdate', 'workinitiateddate', 'dismantledate', 'dismantlingdate']],
  ['material_received',       ['materialreceived', 'matreceived']],
  ['material_received_date',  ['materialreceiveddate', 'matreceiveddate', 'matrecddate']],
  ['packing_done',            ['packingdone', 'packing', 'packed']],
  ['packing_date',            ['packingdate', 'packeddate']],
  ['dc_received',             ['dcreceived', 'dc']],
  ['dc_number',               ['dcnumber', 'dcno']],
  ['sr_done',                 ['srdone', 'sr', 'srstatus']],
  ['sr_no',                   ['srno', 'srnumber']],
  ['sr_date',                 ['srdate']],
  ['sreq_done',               ['sreqdone', 'sreq', 'sreqstatus']],
  ['sreq_number',             ['sreqnumber', 'sreqno']],
  ['sreq_date',               ['sreqdate']],
  ['material_submitted',      ['materialsubmitted', 'matsubmitted', 'submittedatwarehouse']],
  ['material_submitted_date', ['materialsubmitteddate', 'matsubmitteddate', 'submitteddate']],
  ['signed_dc_received',      ['signeddcreceived', 'signeddc']],
  ['signed_dc_date',          ['signeddcdate']],
  ['po_received',             ['poreceived', 'po']],
  ['po_number',               ['ponumber', 'pono']],
  ['po_date',                 ['podate']],
  ['wcc_received',            ['wccreceived', 'wcc']],
  ['wcc_number',              ['wccnumber', 'wccno']],
  ['wcc_date',                ['wccdate']],
  ['wcc_remark',              ['wccremark', 'wccremarks']],
  ['invoice_done',            ['invoicedone', 'invoice', 'invoiced', 'billing']],
  ['invoice_number',          ['invoicenumber', 'invoiceno', 'billno']],
  ['invoice_date',            ['invoicedate', 'billdate']],
  ['payment_received',        ['paymentreceived', 'payment', 'paid']],
  ['payment_date',            ['paymentdate', 'paiddate']],
  ['payment_amount',          ['paymentamount', 'amount', 'amountreceived']],
  ['all_tasks_ultro',         ['alltasksultro', 'alltasksonultro', 'alltasks']],
  ['pending_tasks',           ['pendingtasks', 'pending']],
  ['ru_model',                ['rumodel', 'ru']],
  ['ru_serial_no',            ['ruserialno', 'ruserial', 'ruslno']],
  ['rf_module_name',          ['rfmodulename', 'rfmodule', 'modulename']],
  ['rf_module_serial',        ['rfmoduleserial', 'moduleserial', 'rfserialno']],
  ['rf_module_qty',           ['rfmoduleqty', 'moduleqty']],
  ['gsm_installed',           ['gsminstalled']],
  ['gsm_dismantled',          ['gsmdismantled']],
  ['jumper_type',             ['jumpertype', 'jumper']],
  ['jumper_qty',              ['jumperqty', 'jumperquantity']],
  ['jumper_length',           ['jumperlength']],
  ['cpri_qty',                ['cpriqty', 'cpri']],
  ['cpri_length',             ['cprilength']],
  ['sfp_qty',                 ['sfpqty', 'sfp']],
  ['power_cable_type',        ['powercabletype', 'powercable']],
  ['power_cable_length',      ['powercablelength']],
  ['power_connector_qty',     ['powerconnectorqty', 'powerconnector']],
  ['fpka',                    ['fpka', 'clampfpka']],
  ['tower_height',            ['towerheight']],
  ['antenna_height',          ['antennaheight']],
  ['clamp_details',           ['clampdetails', 'clamp']],
  ['remarks',                 ['remarks', 'remark', 'comments', 'note', 'notes']]
]

const HEADER_TO_COL = {}
for (const [col, keys] of MAP) for (const k of keys) HEADER_TO_COL[k] = col

const DATE_FIELDS = new Set(MAP.map(([c]) => c).filter(c => c.endsWith('_date')))

export default function ImportSheet({ onClose, importRows, reload }) {
  const [sheets, setSheets] = useState(null)   // {names, workbook}
  const [pick, setPick]     = useState('')
  const [preview, setPrev]  = useState(null)
  const [busy, setBusy]     = useState('')
  const { activeVendors, vendor: selected, me } = useApp()
  const [forceVendor, setForce] = useState('')
  const toast = useToast()

  useEscape(onClose)

  async function onFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const buf = await f.arrayBuffer()
      const wb = XLSX.read(buf, { cellDates: true })
      setSheets({ wb, names: wb.SheetNames, fileName: f.name })
      setPick(wb.SheetNames[0] || '')
      setPrev(null)
    } catch (err) {
      toast(`Could not read that file: ${err.message}`, 'bad')
    }
  }

  function build() {
    if (!sheets || !pick) return
    const ws = sheets.wb.Sheets[pick]
    const raw = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, cellDates: true })

    const unknown = new Set()
    const rows = []

    for (const r of raw) {
      const out = { source_sheet: pick, updated_by: me || 'import' }
      for (const [header, value] of Object.entries(r)) {
        const col = HEADER_TO_COL[squash(header)]
        if (!col) { if (String(header).trim()) unknown.add(String(header).trim()); continue }
        out[col] = DATE_FIELDS.has(col) ? parseDate(value) : String(value ?? '').trim()
      }
      if (!out.site_id) continue

      // Resolve "Mobilecom" to "UST" on the way in, so one company never
      // ends up as two vendors.
      if (out.vendor) out.vendor = resolveVendor(activeVendors, out.vendor) || out.vendor
      if (forceVendor) out.vendor = forceVendor
      else if (!out.vendor && selected && selected !== 'All' && selected !== 'Unassigned') out.vendor = selected

      rows.push(out)
    }

    setPrev({ rows, unknown: [...unknown], sheet: pick })
  }

  async function run() {
    if (!preview?.rows.length) return
    setBusy('Working…')
    try {
      const n = await importRows(preview.rows, (done, total) => setBusy(`${done} of ${total}…`))
      toast(`${n} sites imported from ${preview.sheet}.`, 'good')
      await reload?.()
      onClose()
    } catch (err) {
      toast(err.message, 'bad')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="scrim" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-h">
          <h2>Import from Excel</h2>
          <button className="ghost right" onClick={onClose}>Close</button>
        </div>

        <div className="modal-b">
          <div className="note info">
            One sheet at a time. Each row is matched on Site ID — an existing
            site is updated, a new one is added. The sheet name is saved against
            every row so you can tell later where it came from.
          </div>

          <label>Excel file</label>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} />

          {sheets && (
            <div className="grid2" style={{ marginTop: 14 }}>
              <div>
                <label>Sheet ({sheets.names.length} in this file)</label>
                <select value={pick} onChange={e => { setPick(e.target.value); setPrev(null) }}>
                  {sheets.names.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label>Force every row to a vendor</label>
                <select value={forceVendor} onChange={e => { setForce(e.target.value); setPrev(null) }}>
                  <option value="">Use the sheet's own vendor column</option>
                  {activeVendors.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {sheets && !preview && (
            <button className="pri" style={{ marginTop: 14 }} onClick={build}>Check the sheet</button>
          )}

          {preview && (
            <>
              <div className={`note ${preview.rows.length ? 'okN' : 'badN'}`} style={{ marginTop: 14 }}>
                <b>{preview.rows.length}</b> rows with a Site ID, ready to import from <b>{preview.sheet}</b>.
              </div>

              {preview.unknown.length > 0 && (
                <div className="note warnN">
                  <b>{preview.unknown.length} columns not recognised</b> and skipped:{' '}
                  <span className="sm">{preview.unknown.join(' · ')}</span>
                  <div className="sm" style={{ marginTop: 6 }}>
                    Nothing breaks — tell me which of these matter and I'll add them.
                  </div>
                </div>
              )}

              {preview.rows.length > 0 && (
                <div className="tbl-wrap" style={{ maxHeight: 260 }}>
                  <table>
                    <thead>
                      <tr><th>Site ID</th><th>Name</th><th>Vendor</th><th>City</th><th>Work date</th></tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 25).map((r, i) => (
                        <tr key={i}>
                          <td className="mono">{r.site_id}</td>
                          <td>{r.site_name || '—'}</td>
                          <td>{r.vendor || <span className="fnt">none</span>}</td>
                          <td>{r.city || '—'}</td>
                          <td className="sm">{r.work_date || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-f">
          <button className="pri" disabled={!preview?.rows.length || !!busy} onClick={run}>
            {busy || `Import ${preview?.rows.length || 0} rows`}
          </button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
