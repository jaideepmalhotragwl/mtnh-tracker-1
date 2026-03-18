# MTNH Project Tracker

Tower operations tracking app for Malhotra Tower Network Hub LLP.

## Tech Stack
- **Frontend:** React + Vite
- **Database:** Google Sheets (via Apps Script)
- **Hosting:** Vercel
- **Auth:** Password gate (env variable)

---

## 🚀 Deployment Guide

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit — MTNH Tracker"
git remote add origin https://github.com/YOUR_USERNAME/mtnh-tracker.git
git push -u origin main
```

### Step 2 — Deploy on Vercel

1. Go to vercel.com → Add New Project
2. Import your `mtnh-tracker` GitHub repo
3. Framework preset: Vite (auto-detected)
4. Add Environment Variable:
   VITE_APP_PASSWORD = your_chosen_password
5. Click Deploy — live in ~60 seconds

Every git push to main auto-deploys.

---

## 🗄️ Google Sheets Setup

### 1. Create the Sheet
- Go to sheets.google.com
- New spreadsheet → rename first tab to: MTNH_Projects

### 2. Add Apps Script
Extensions → Apps Script → paste this:

```javascript
function doGet(e) {
  var tab = e.parameter.tab || 'MTNH_Projects';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(tab);
  if (!sh || sh.getLastRow() < 1) {
    return ContentService.createTextOutput(JSON.stringify({ headers: [], rows: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var data = sh.getDataRange().getValues();
  return ContentService.createTextOutput(JSON.stringify({ headers: data[0], rows: data.slice(1) }))
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
}
```

### 3. Deploy as Web App
Deploy → New Deployment → Web App
- Execute as: Me
- Who has access: Anyone
- Copy the Web App URL

### 4. Connect in the App
Click ⚙ Config → paste URL → Save Config

---

## 🔐 Password

Change VITE_APP_PASSWORD in Vercel → Settings → Environment Variables

---

## 💻 Local Dev

```bash
cp .env.example .env.local
npm install
npm run dev
```
