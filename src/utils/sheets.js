import { SHEET_HEADERS, projectToSheetRow } from './constants'
import { getStageMeta } from './stageLogic'

const CONFIG_KEY = 'mtnh_sheet_config'

export function loadSheetConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') } catch { return {} }
}

export function saveSheetConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
}

export async function exportToSheets(projects) {
  const cfg = loadSheetConfig()
  if (!cfg.url) throw new Error('No Google Sheets URL configured in ⚙ Config')
  const rows = projects.map(p => projectToSheetRow(p, getStageMeta(p).label))
  await fetch(cfg.url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'write', tab: cfg.tab || 'MTNH_Projects', headers: SHEET_HEADERS, rows }),
  })
  return projects.length
}

export const APPS_SCRIPT = `function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(data.tab) || ss.insertSheet(data.tab);
  sh.clearContents();
  sh.appendRow(data.headers);
  data.rows.forEach(function(r) { sh.appendRow(r); });
  return ContentService.createTextOutput('OK');
}`
