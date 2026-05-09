/**
 * PCCF Summary spreadsheet -> Bidwell repo automation.
 *
 * Adds a "PCCF" menu to the spreadsheet with:
 *   - Validate JSON           (parses B1 of JSON Data, runs schema checks)
 *   - Show summary            (portfolio stats from the parsed JSON)
 *   - View raw JSON           (modal with the JSON Data!B1 string)
 *   - Push to GitHub          (validates, then opens a PR against main)
 *   - Set GitHub token        (stores a PAT in Script Properties)
 *
 * INSTALL
 * -------
 * 1. Open the spreadsheet -> Extensions -> Apps Script.
 * 2. Replace the contents of Code.gs with this file.
 * 3. Save, then reload the spreadsheet so onOpen runs.
 * 4. PCCF menu -> Set GitHub token. Paste a fine-grained PAT scoped to
 *    adampenn/bidwellcapitalfund.com with Contents: Read & Write and
 *    Pull requests: Read & Write. Stored in Script Properties (sheet-scoped,
 *    not visible in cells).
 * 5. PCCF menu -> Validate JSON to confirm everything's wired up.
 */

const REPO_OWNER = 'adampenn';
const REPO_NAME = 'bidwellcapitalfund.com';
const FILE_PATH = 'public/pccf-data.json';
const BASE_BRANCH = 'main';
const JSON_CELL = "'JSON Data'!B1";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('PCCF')
    .addItem('Validate JSON', 'pccfValidate')
    .addItem('Show summary', 'pccfShowSummary')
    .addItem('View raw JSON', 'pccfShowJson')
    .addSeparator()
    .addItem('Push to GitHub (open PR)', 'pccfPushToGithub')
    .addSeparator()
    .addItem('Set GitHub token', 'pccfSetToken')
    .addItem('Clear GitHub token', 'pccfClearToken')
    .addToUi();
}

// ---------- core ----------

function readJsonCell_() {
  const v = SpreadsheetApp.getActive().getRange(JSON_CELL).getValue();
  return String(v == null ? '' : v);
}

function validate_() {
  const raw = readJsonCell_();
  const errors = [];
  const warnings = [];

  if (!raw || !raw.startsWith('{')) {
    return { ok: false, errors: ['JSON Data!B1 is empty or does not look like JSON.'], warnings, raw };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { ok: false, errors: ['JSON parse failed: ' + e.message], warnings, raw };
  }

  if (!data.meta || typeof data.meta !== 'object') {
    errors.push('Missing meta object.');
  } else {
    if (!(data.meta.portfolioSize > 0)) errors.push('meta.portfolioSize invalid: ' + data.meta.portfolioSize);
    if (!(data.meta.grossYield > 0 && data.meta.grossYield < 50)) errors.push('meta.grossYield out of expected range (0-50): ' + data.meta.grossYield);
    if (!(data.meta.ltv >= 0 && data.meta.ltv <= 100)) errors.push('meta.ltv out of range (0-100): ' + data.meta.ltv);
  }

  if (!Array.isArray(data.deals) || data.deals.length === 0) {
    errors.push('Missing or empty deals array.');
    return { ok: false, errors, warnings, data, raw };
  }

  const required = ['num','date','location','asset','posType','security','amt','ltv','ytm','term','takeout','rate'];
  const seenNums = {};

  data.deals.forEach(function(d, i) {
    const tag = 'Deal ' + (d.num || ('row ' + (i + 1)));

    required.forEach(function(k) {
      const v = d[k];
      if (v === undefined || v === null || v === '') errors.push(tag + ': missing ' + k);
    });

    if (typeof d.num === 'string') {
      if (!/^#\d+$/.test(d.num)) errors.push(tag + ': num should match #N format, got "' + d.num + '"');
      if (seenNums[d.num]) errors.push(tag + ': duplicate deal number');
      seenNums[d.num] = true;
    }

    if (typeof d.amt === 'number' && !(d.amt > 0)) errors.push(tag + ': amt must be > 0 (got ' + d.amt + ')');
    if (typeof d.ltv === 'number' && (d.ltv < 0 || d.ltv > 100)) errors.push(tag + ': ltv out of range (got ' + d.ltv + ')');
    if (typeof d.ytm === 'number' && (d.ytm < 0 || d.ytm > 50)) errors.push(tag + ': ytm out of range (got ' + d.ytm + ')');
    if (typeof d.paidOff !== 'boolean') errors.push(tag + ': paidOff must be boolean (got ' + typeof d.paidOff + ')');

    // Orphan logic
    if (d.outcome && !d.paidOff) errors.push(tag + ': outcome present but paidOff is false');
    if (d.paidOff && (d.paidOffDate === undefined || d.paidOffDate === null)) errors.push(tag + ': paidOff true but paidOffDate missing');
    if (!d.paidOff && d.paidOffDate !== undefined && d.paidOffDate !== null) errors.push(tag + ': paidOffDate set but paidOff is false');
    if (d.watchListNote && !d.watchList) errors.push(tag + ': watchListNote set but watchList is false');
    if (d.watchList === true && d.paidOff === true) warnings.push(tag + ': both watchList and paidOff are true (unusual)');

    // Bullet arrays
    ['thesis','capitalProtection'].forEach(function(k) {
      if (d[k] === undefined) return;
      if (!Array.isArray(d[k])) {
        errors.push(tag + ': ' + k + ' must be an array');
        return;
      }
      if (d[k].length === 0) warnings.push(tag + ': ' + k + ' is an empty array (will be omitted)');
      d[k].forEach(function(b, j) {
        if (typeof b !== 'string' || !b.trim()) errors.push(tag + ': ' + k + '[' + j + '] empty or non-string');
      });
    });

    if (Array.isArray(d.rate)) {
      d.rate.forEach(function(r, j) {
        if (typeof r !== 'string' || !r.trim()) errors.push(tag + ': rate[' + j + '] empty');
      });
    }

    if (d.outcome) {
      const oc = d.outcome;
      if (oc.returnPct !== undefined && !(typeof oc.returnPct === 'number' && oc.returnPct >= 0 && oc.returnPct <= 100)) {
        errors.push(tag + ': outcome.returnPct out of range (0-100)');
      }
      if (oc.holdMonths !== undefined && !(typeof oc.holdMonths === 'number' && oc.holdMonths > 0)) {
        errors.push(tag + ': outcome.holdMonths must be a positive number');
      }
    }
  });

  return { ok: errors.length === 0, errors, warnings, data, raw };
}

// ---------- menu items ----------

function pccfValidate() {
  const ui = SpreadsheetApp.getUi();
  const v = validate_();
  const lines = [];
  lines.push(v.ok ? 'PASS' : 'FAIL');
  lines.push('');
  lines.push(v.errors.length + ' error(s), ' + v.warnings.length + ' warning(s)');
  if (v.errors.length) {
    lines.push('');
    lines.push('ERRORS:');
    v.errors.forEach(function(e) { lines.push('  - ' + e); });
  }
  if (v.warnings.length) {
    lines.push('');
    lines.push('WARNINGS:');
    v.warnings.forEach(function(w) { lines.push('  - ' + w); });
  }
  ui.alert('PCCF JSON validation', lines.join('\n'), ui.ButtonSet.OK);
}

function pccfShowSummary() {
  const ui = SpreadsheetApp.getUi();
  const v = validate_();
  if (!v.data) {
    ui.alert('Cannot summarize', v.errors.join('\n'), ui.ButtonSet.OK);
    return;
  }
  const d = v.data;
  const active = d.deals.filter(function(x) { return !x.paidOff; });
  const paid = d.deals.filter(function(x) { return x.paidOff; });
  const watch = d.deals.filter(function(x) { return x.watchList; });
  const fmt = function(n) { return '$' + Math.round(n).toLocaleString(); };
  const sum = function(arr, k) { return arr.reduce(function(a,x){ return a + (Number(x[k]) || 0); }, 0); };

  const lines = [
    'Portfolio size: ' + fmt(d.meta.portfolioSize),
    'Gross yield: ' + d.meta.grossYield + '%',
    'Combined LTV: ' + d.meta.ltv + '%',
    '',
    'Deals: ' + d.deals.length + ' total',
    '  Active: ' + active.length + ' (' + fmt(sum(active, 'amt')) + ')',
    '  Paid off: ' + paid.length + ' (' + fmt(sum(paid, 'amt')) + ')',
    '  On watch list: ' + watch.length,
    '',
    'Validation: ' + (v.ok ? 'PASS' : (v.errors.length + ' error(s)'))
  ];
  ui.alert('PCCF portfolio summary', lines.join('\n'), ui.ButtonSet.OK);
}

function pccfShowJson() {
  const raw = readJsonCell_();
  const html = HtmlService.createHtmlOutput(
    '<style>body{font-family:monospace;font-size:11px;margin:0;padding:8px}textarea{width:100%;height:420px;font-family:monospace;font-size:11px}</style>' +
    '<p>JSON Data!B1 (' + raw.length + ' chars). Select all, copy as needed.</p>' +
    '<textarea readonly>' + raw.replace(/[&<>]/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}) + '</textarea>'
  ).setWidth(720).setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'Raw PCCF JSON');
}

function pccfSetToken() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt(
    'GitHub token',
    'Paste a fine-grained PAT for ' + REPO_OWNER + '/' + REPO_NAME +
      '\nScopes needed: Contents (Read & Write), Pull requests (Read & Write).',
    ui.ButtonSet.OK_CANCEL
  );
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const t = (r.getResponseText() || '').trim();
  if (!t) { ui.alert('No token entered.'); return; }
  PropertiesService.getScriptProperties().setProperty('GITHUB_TOKEN', t);
  ui.alert('Token saved to Script Properties.');
}

function pccfClearToken() {
  PropertiesService.getScriptProperties().deleteProperty('GITHUB_TOKEN');
  SpreadsheetApp.getUi().alert('Token cleared.');
}

// ---------- GitHub push ----------

function pccfPushToGithub() {
  const ui = SpreadsheetApp.getUi();
  const v = validate_();
  if (!v.ok) {
    ui.alert('Validation failed',
      'Fix these errors before pushing:\n\n' + v.errors.slice(0, 12).join('\n') +
        (v.errors.length > 12 ? '\n... (' + (v.errors.length - 12) + ' more)' : ''),
      ui.ButtonSet.OK);
    return;
  }

  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) {
    ui.alert('No token', 'Run: PCCF -> Set GitHub token first.', ui.ButtonSet.OK);
    return;
  }

  const c = ui.alert(
    'Push PCCF data to GitHub?',
    v.data.deals.length + ' deals will be committed to a new branch and a PR opened against ' + BASE_BRANCH + '.',
    ui.ButtonSet.OK_CANCEL
  );
  if (c !== ui.Button.OK) return;

  try {
    // 1. Base branch HEAD
    const ref = ghJson_('GET', '/repos/' + REPO_OWNER + '/' + REPO_NAME + '/git/ref/heads/' + BASE_BRANCH);
    const baseSha = ref.object.sha;

    // 2. Existing file (if any) on main
    let existingFileSha = null;
    let existingContent = null;
    const existingResp = ghRaw_('GET', '/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/' + FILE_PATH + '?ref=' + BASE_BRANCH);
    if (existingResp.code === 200) {
      const meta = JSON.parse(existingResp.body);
      existingFileSha = meta.sha;
      const decoded = Utilities.newBlob(Utilities.base64Decode(meta.content.replace(/\n/g, ''))).getDataAsString();
      existingContent = decoded;
    } else if (existingResp.code !== 404) {
      throw new Error('Unexpected ' + existingResp.code + ' fetching existing file: ' + existingResp.body);
    }

    if (existingContent && existingContent === v.raw) {
      ui.alert('No changes', 'JSON Data!B1 already matches main. Nothing to push.', ui.ButtonSet.OK);
      return;
    }

    // 3. New branch from main HEAD
    const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmm');
    const branchName = 'pccf-data-' + ts;
    ghJson_('POST', '/repos/' + REPO_OWNER + '/' + REPO_NAME + '/git/refs', {
      ref: 'refs/heads/' + branchName,
      sha: baseSha
    });

    // 4. Put new file content on the new branch
    const body = {
      message: 'Update PCCF deal data (' + v.data.deals.length + ' deals)',
      content: Utilities.base64Encode(v.raw, Utilities.Charset.UTF_8),
      branch: branchName
    };
    if (existingFileSha) body.sha = existingFileSha;
    ghJson_('PUT', '/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/' + FILE_PATH, body);

    // 5. Open PR
    const prBody = buildPrBody_(v.data, existingContent ? safeParse_(existingContent) : null, v.warnings);
    const pr = ghJson_('POST', '/repos/' + REPO_OWNER + '/' + REPO_NAME + '/pulls', {
      title: 'Update PCCF deal data ' + ts,
      head: branchName,
      base: BASE_BRANCH,
      body: prBody
    });

    const html = HtmlService.createHtmlOutput(
      '<style>body{font-family:Arial,sans-serif;padding:14px;font-size:13px}a{color:#1a73e8}</style>' +
      '<p><strong>PR opened.</strong></p>' +
      '<p><a href="' + pr.html_url + '" target="_blank" rel="noopener">' + pr.html_url + '</a></p>' +
      '<p>Review the diff and merge when ready. Render redeploys on merge to main.</p>'
    ).setWidth(520).setHeight(180);
    ui.showModalDialog(html, 'PR created');
  } catch (e) {
    ui.alert('Push failed', String(e && e.message || e), ui.ButtonSet.OK);
  }
}

function buildPrBody_(newData, oldData, warnings) {
  const lines = ['## Summary', '', newData.deals.length + ' deals total.'];

  if (oldData && Array.isArray(oldData.deals)) {
    const oldByNum = {};
    oldData.deals.forEach(function(d){ oldByNum[d.num] = d; });
    const newByNum = {};
    newData.deals.forEach(function(d){ newByNum[d.num] = d; });

    const added = [];
    const removed = [];
    const changed = [];
    Object.keys(newByNum).forEach(function(n){ if (!oldByNum[n]) added.push(n); });
    Object.keys(oldByNum).forEach(function(n){ if (!newByNum[n]) removed.push(n); });
    Object.keys(newByNum).forEach(function(n){
      if (oldByNum[n] && JSON.stringify(oldByNum[n]) !== JSON.stringify(newByNum[n])) changed.push(n);
    });

    lines.push('');
    if (added.length) lines.push('**Added:** ' + added.join(', '));
    if (removed.length) lines.push('**Removed:** ' + removed.join(', '));
    if (changed.length) lines.push('**Modified:** ' + changed.join(', '));
    if (!added.length && !removed.length && !changed.length) {
      lines.push('Meta-only change (portfolio size / yield / ltv).');
    }

    if (oldData.meta && newData.meta) {
      const m = oldData.meta, n = newData.meta;
      const metaChanges = [];
      if (m.portfolioSize !== n.portfolioSize) metaChanges.push('portfolioSize: ' + m.portfolioSize + ' -> ' + n.portfolioSize);
      if (m.grossYield !== n.grossYield) metaChanges.push('grossYield: ' + m.grossYield + ' -> ' + n.grossYield);
      if (m.ltv !== n.ltv) metaChanges.push('ltv: ' + m.ltv + ' -> ' + n.ltv);
      if (metaChanges.length) {
        lines.push('');
        lines.push('**Meta:**');
        metaChanges.forEach(function(c){ lines.push('- ' + c); });
      }
    }
  } else {
    lines.push('');
    lines.push('Initial commit of PCCF data.');
  }

  if (warnings && warnings.length) {
    lines.push('');
    lines.push('## Validation warnings');
    warnings.forEach(function(w){ lines.push('- ' + w); });
  }

  lines.push('');
  lines.push('Generated from PCCF Summary spreadsheet via Apps Script.');
  return lines.join('\n');
}

function safeParse_(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}

// ---------- GitHub HTTP helpers ----------

function ghHeaders_() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('No GitHub token. Run: PCCF -> Set GitHub token.');
  return {
    Authorization: 'token ' + token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

function ghRaw_(method, path, body) {
  const opts = { method: method, headers: ghHeaders_(), muteHttpExceptions: true };
  if (body !== undefined) {
    opts.contentType = 'application/json';
    opts.payload = JSON.stringify(body);
  }
  const r = UrlFetchApp.fetch('https://api.github.com' + path, opts);
  return { code: r.getResponseCode(), body: r.getContentText() };
}

function ghJson_(method, path, body) {
  const r = ghRaw_(method, path, body);
  if (r.code >= 300) throw new Error('GitHub ' + method + ' ' + path + ': ' + r.code + ' ' + r.body);
  return JSON.parse(r.body);
}
