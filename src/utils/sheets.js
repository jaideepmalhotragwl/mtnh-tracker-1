import { SHEET_HEADERS, projectToRow } from './constants'
import { getStageMeta } from './stageLogic'

const CONFIG_KEY = 'mtnh_sheet_config'

export function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
}

export async function fetchFromSheets(url, tab) {
  if (!url) throw new Error('No sheet URL configured')
  const res = await fetch(`${url}?action=read&tab=${encodeURIComponent(tab)}`)
  const json = await res.json()
  if (!json.rows || !json.headers) throw new Error('Invalid response from sheet')
  return json.rows.map(row => {
    const obj = {}
    json.headers.forEach((h, i) => { obj[h] = row[i] || '' })
    return obj
  })
}

export async function pushToSheets(url, tab, projects) {
  if (!url) throw new Error('No sheet URL configured')
  const rows = projects.map(p => projectToRow(p, q => getStageMeta(q).label))
  await fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'write', tab, headers: SHEET_HEADERS, rows }),
  })
}

// Apps Script to paste into the Google Sheet
export const APPS_SCRIPT = `function doGet(e) {
  var tab = e.parameter.tab || 'MTNH_Projects';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(tab);
  if (!sh || sh.getLastRow() < 1) {
    return ContentService.createTextOutput(JSON.stringify({ headers: [], rows: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var rows = data.slice(1);
  return ContentService.createTextOutput(JSON.stringify({ headers, rows }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(data.tab) || ss.insertSheet(data.tab);
  sh.clearContents();
  sh.appendRow(data.headers);
  data.rows.forEach(function(r) { sh.appendRow(r); });
  return ContentService.createTextOutput('OK');
}`
