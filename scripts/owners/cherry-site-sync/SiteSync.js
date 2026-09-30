/**
 * Website auto-publish for the 946 Cherry Asset Mgmt sheet -> bidwellcapitalfund.com/cherry-20
 *
 * Lives in the sheet's bound Apps Script project next to QboSync / Menu / JournalEntry.
 * Source of truth for this file: bidwellcapitalfund.com repo, scripts/owners/cherry-site-sync/.
 * Deploy with clasp (see README.md in that folder).
 *
 * Daily trigger (siteSyncDaily):
 *   1. Syncs QuickBooks P&L + Balance Sheet through the last COMPLETED month (never the
 *      in-progress month).
 *   2. Waits until that month is closed out in the sheet: Rent Roll rows entered, Monthly
 *      Inputs filled, P&L NOI present, Dashboard showing that month.
 *   3. Builds src/data/owners/946-cherry.json, and appends any new "Bidwell Cherry 20 - ...
 *      Update" email to src/data/owners/946-cherry-updates.json.
 *   4. Verifies the result (month continuity, rent roll shape, NOI/revenue sanity vs history
 *      and rent roll, no restated history, value/loan/reserve drift, no tenant names).
 *   5. All checks pass -> commits to a branch, opens a PR, squash-merges it. Render deploys.
 *      Any check fails, or the month is stuck -> emails Adam and publishes nothing.
 *   6. ~30 min after a merge, confirms the live page shows the new month; emails if not.
 *
 * Script Properties used: GITHUB_TOKEN (fine-grained PAT, Contents + Pull requests R/W on
 * adampenn/bidwellcapitalfund.com), optional SITE_ALERT_EMAIL, SITE_EARLIEST_DAY.
 * Internal state: SITE_ALERT_HASH, SITE_ALERT_AT, SITE_PUBLISHED_AT, SITE_PUBLISHED_ASOF.
 */

const SITE = {
  owner: 'adampenn',
  repo: 'bidwellcapitalfund.com',
  branch: 'main',
  dataPath: 'src/data/owners/946-cherry.json',
  updatesPath: 'src/data/owners/946-cherry-updates.json',
  liveUrl: 'https://bidwellcapitalfund.com/cherry-20',
  tz: 'America/Los_Angeles',
  basis: 1460000,          // purchase price shown on the implied-value KPI
  lpCapital: 485000,       // LP equity; sale waterfall returns this before the 80/20 split
  marketRent: 900,
  earliestDay: 3,          // publish month M no earlier than the 3rd of M+1 (books settle)
  stuckDay: 10,            // email if month M still is not published by the 10th of M+1
  emailSubjectPrefix: 'Bidwell Cherry 20 - ',
};

// ── Entry points ─────────────────────────────────────────────────────────────

function siteSyncDaily() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(60 * 1000)) return;
  try {
    const res = siteRun_({ publish: true, force: false });
    Logger.log(JSON.stringify(res.log));
  } catch (err) {
    siteAlert_('Website sync crashed', ['The daily run threw an error: ' + err + (err && err.stack ? '\n' + err.stack : '')]);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function siteCheckNow() {
  const res = siteRun_({ publish: false, force: false, manual: true });
  siteShow_('Website check (nothing published)', res);
}

function sitePublishNow() {
  const res = siteRun_({ publish: true, force: false, manual: true });
  siteShow_('Website publish', res);
}

function sitePublishOverride() {
  const ui = SpreadsheetApp.getUi();
  const dry = siteRun_({ publish: false, force: false, manual: true });
  if (!dry.problems.length) { siteShow_('Nothing to override', dry); return; }
  const ok = ui.alert('Publish despite failed checks?',
    dry.problems.map(function (p) { return '• ' + p; }).join('\n') + '\n\nPublish anyway?',
    ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  const res = siteRun_({ publish: true, force: true, manual: true });
  siteShow_('Website publish (checks overridden)', res);
}

function siteInstallTrigger() {
  siteRemoveTrigger();
  ScriptApp.newTrigger('siteSyncDaily').timeBased().everyDays(1).atHour(7).inTimezone(SITE.tz).create();
  SpreadsheetApp.getUi().alert('Daily website sync installed (runs ~7am Pacific).\nAlerts go to ' + siteAlertEmail_() + '.');
}

function siteRemoveTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'siteSyncDaily') ScriptApp.deleteTrigger(t);
  });
}

function siteSetGithubToken() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('GitHub token', 'Fine-grained PAT for adampenn/bidwellcapitalfund.com with Contents: Read & Write and Pull requests: Read & Write.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const t = r.getResponseText().trim();
  if (!t) return;
  PropertiesService.getScriptProperties().setProperty('GITHUB_TOKEN', t);
  try {
    siteGh_('GET', '/repos/' + SITE.owner + '/' + SITE.repo);
    ui.alert('Token saved and it can read the repo.');
  } catch (e) {
    ui.alert('Token saved, but the test call failed: ' + e);
  }
}

// Runs from a one-off trigger ~30 minutes after a merge.
function siteVerifyDeploy() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'siteVerifyDeploy') ScriptApp.deleteTrigger(t);
  });
  const props = PropertiesService.getScriptProperties();
  const asOf = props.getProperty('SITE_PUBLISHED_ASOF');
  if (!asOf) return;
  const html = UrlFetchApp.fetch(SITE.liveUrl, { muteHttpExceptions: true, followRedirects: true }).getContentText();
  if (html.indexOf('"asOf":"' + asOf + '"') === -1) {
    siteAlert_('Website did not update', [
      'The merge for ' + asOf + ' went through, but ' + SITE.liveUrl + ' still does not show ' + asOf + ' about 30 minutes later.',
      'Check the Render deploy for bidwellcapitalfund.com.',
    ]);
  }
}

// ── Core run ─────────────────────────────────────────────────────────────────

function siteRun_(opts) {
  const log = [];
  const problems = [];
  const today = new Date();
  const target = sitePrevMonth_(today);            // last completed month, e.g. "Sep 2026"
  const day = Number(Utilities.formatDate(today, SITE.tz, 'd'));
  log.push('Target month: ' + target);

  // 1. QuickBooks sync through the end of the target month.
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const syncResults = ['pnl', 'bs'].map(function (kind) {
    return runReportSync({ kind: kind, range: siteSyncRange_(target) });
  });
  syncResults.forEach(function (r) {
    if (!r.ok) problems.push('QuickBooks ' + r.label + ' sync failed: ' + r.error);
    else log.push('QB ' + r.label + ': ' + r.updated + ' rows updated' + (r.unmatched && r.unmatched.length ? ', unmatched: ' + r.unmatched.join(', ') : ''));
  });
  SpreadsheetApp.flush();

  // 2. Read the sheet and the published files.
  const sheet = siteReadSheet_(ss);
  const pubData = siteGhFile_(SITE.dataPath);
  const pubUpdates = siteGhFile_(SITE.updatesPath);
  const prev = JSON.parse(pubData.text);
  const prevUpdates = JSON.parse(pubUpdates.text);
  log.push('Published: ' + prev.asOf + '. Sheet dashboard: ' + sheet.dash.month + '.');

  // 3. Is the target month ready?
  const notReady = siteReadiness_(sheet, target);
  const monthAhead = siteMonthIndex_(target) > siteMonthIndex_(prev.asOf);
  let dataText = pubData.text;
  let doc = null;

  if (notReady.length) {
    log.push('Not ready for ' + target + ': ' + notReady.join('; '));
    if (monthAhead && day >= SITE.stuckDay) {
      problems.push(target + ' is not on the website yet and the sheet is not ready: ' + notReady.join('; '));
    }
  } else if (monthAhead && day < siteEarliestDay_() && !opts.force && !opts.manual) {
    log.push('Waiting until day ' + siteEarliestDay_() + ' to publish ' + target + '.');
  } else {
    doc = siteBuildDoc_(sheet, target, prev);
    if (!monthAhead && siteNumbersOf_(doc) === siteNumbersOf_(prev)) {
      // Same month, same numbers: keep whatever text is published (it may be hand-written).
      doc = null;
      log.push(target + ' is already published and its numbers have not changed.');
    } else {
      dataText = JSON.stringify(doc, null, 2) + '\n';
      siteVerify_(doc, prev, sheet, target).forEach(function (p) { problems.push(p); });
    }
  }

  // 4. New update email for the archive?
  let updatesText = pubUpdates.text;
  const newEmail = siteFindNewUpdateEmail_(prevUpdates);
  if (newEmail) {
    const names = siteTenantNamesIn_(newEmail.html, sheet.tenantNames);
    if (names.length) {
      problems.push('Update email "' + newEmail.title + '" mentions tenant name(s): ' + names.join(', ') + '. Not adding it to the archive.');
    } else {
      const merged = { property: prevUpdates.property, updates: [newEmail].concat(prevUpdates.updates) };
      updatesText = JSON.stringify(merged, null, 2) + '\n';
      log.push('New update email for the archive: ' + newEmail.title);
    }
  }

  const changed = [];
  if (dataText !== pubData.text) changed.push(SITE.dataPath);
  if (updatesText !== pubUpdates.text) changed.push(SITE.updatesPath);
  log.push(changed.length ? 'Changes: ' + changed.join(', ') : 'No changes to publish.');

  const result = { target: target, log: log, problems: problems, changed: changed, published: false };
  if (problems.length && !opts.force) {
    if (opts.publish) siteAlert_('Website not updated: ' + target, problems, log);
    return result;
  }
  if (!changed.length || !opts.publish) return result;

  // 5. Publish: branch -> PR -> squash merge.
  const files = {};
  if (dataText !== pubData.text) files[SITE.dataPath] = dataText;
  if (updatesText !== pubUpdates.text) files[SITE.updatesPath] = updatesText;
  const title = doc && doc.asOf !== prev.asOf
    ? 'Cherry 20: ' + doc.asOf + ' data (auto)'
    : (doc ? 'Cherry 20: refresh ' + doc.asOf + ' data (auto)' : 'Cherry 20: add update email to archive (auto)');
  const body = siteChangeSummary_(doc, prev, newEmail, log, problems, opts.force);
  try {
    const pr = siteGhPublish_(files, title, body);
    result.published = true;
    result.pr = pr;
    log.push('Merged ' + pr);
    const props = PropertiesService.getScriptProperties();
    props.setProperty('SITE_PUBLISHED_AT', String(Date.now()));
    if (doc) props.setProperty('SITE_PUBLISHED_ASOF', doc.asOf);
    props.deleteProperty('SITE_ALERT_HASH');
    ScriptApp.newTrigger('siteVerifyDeploy').timeBased().after(30 * 60 * 1000).create();
  } catch (err) {
    siteAlert_('Website publish failed: ' + target, ['GitHub step failed: ' + err], log);
    throw err;
  }
  return result;
}

// ── Sheet reading ────────────────────────────────────────────────────────────

function siteReadSheet_(ss) {
  // Dashboard: label -> display values of the row (cols B..F).
  const dashRows = ss.getSheetByName('Dashboard').getRange('A1:F80').getDisplayValues();
  const byLabel = [];
  dashRows.forEach(function (r) { if (r[0].trim()) byLabel.push({ label: r[0].trim(), vals: r.slice(1) }); });
  function find(prefix, col, occurrence) {
    let seen = 0;
    for (let i = 0; i < byLabel.length; i++) {
      if (byLabel[i].label.toLowerCase().indexOf(prefix.toLowerCase()) === 0) {
        if (seen === (occurrence || 0)) return { label: byLabel[i].label, value: (byLabel[i].vals[col || 0] || '').trim() };
        seen++;
      }
    }
    return { label: '', value: '' };
  }
  const implied = find('Implied Value');
  const dash = {
    month: find('Latest Reporting Month').value,
    operatingMonth: siteNum_(find('Operating Month').value),
    income: siteNum_(find('Total Income').value),
    incomePF: siteNum_(find('Total Income', 1).value),
    opex: siteNum_(find('Total Operating Expenses').value),
    opexPF: siteNum_(find('Total Operating Expenses', 1).value),
    noi: siteNum_(find('Net Operating Income').value),
    noiPF: siteNum_(find('Net Operating Income', 1).value),
    t3: siteNum_(find('T-3 NOI').value),
    t12: siteNum_(find('T-12 NOI').value),
    t12Var: siteNum_(find('T-12 NOI', 2).value),
    reserves: siteNum_(find('Reserves Balance').value),
    occupancy: siteNum_(find('Occupancy %').value),
    delinquency: siteNum_(find('Accounts Receivable').value),
    avgRent: siteNum_(find('Avg Rent / Occupied Unit').value),
    rentGrowth: siteNum_(find('Avg Rent Growth').value),
    distributions: siteNum_(find('LP Distributions Paid').value),
    implied: siteNum_(implied.value),
    impliedBasis: ((implied.label.match(/\((T-\d+)/) || [])[1]) || '',
    multiple: find('LP Equity Multiple').value,
    loan: siteNum_(find('Loan Balance').value),
    principalCum: siteNum_(find('Principal Paid Down (cumulative)').value),
  };

  // P&L: month labels + NOI and income rows (raw numbers).
  const pnlTab = ss.getSheetByName('P&L Data');
  const pnl = pnlTab.getDataRange().getValues();
  let months = [], noi = [], income = [];
  for (let r = 0; r < pnl.length; r++) {
    const a = String(pnl[r][0]).trim();
    if (a.toLowerCase() === 'line item') months = pnl[r].slice(1).map(formatMonthLabel);
    if (a === 'Net Operating Income') noi = pnl[r].slice(1);
    if (a === 'Total for Income') income = pnl[r].slice(1);
  }
  const pnlByMonth = {};
  months.forEach(function (m, i) {
    if (m) pnlByMonth[m] = { noi: siteRaw_(noi[i]), income: siteRaw_(income[i]) };
  });

  // Rent Roll: header row names the columns; month rows follow.
  const rr = ss.getSheetByName('Rent Roll').getDataRange().getDisplayValues();
  let cols = null;
  const rentByMonth = {};
  const monthOrder = [];
  const tenantNames = {};
  rr.forEach(function (r) {
    if (!cols && r[0].trim() === 'Month') {
      cols = {};
      r.forEach(function (h, i) { cols[h.trim().toLowerCase()] = i; });
      return;
    }
    if (!cols || !/^[A-Z][a-z]{2} \d{4}$/.test(r[0].trim())) return;
    const m = r[0].trim();
    if (!rentByMonth[m]) { rentByMonth[m] = []; monthOrder.push(m); }
    const row = {
      unit: r[cols['unit #']].trim(),
      tenant: r[cols['tenant']].trim(),
      status: r[cols['status']].trim(),
      rent: siteNum_(r[cols['scheduled rent']]),
      rubs: siteNum_(r[cols['rubs']]) || 0,
      pet: siteNum_(r[cols['pet rent']]) || 0,
      internet: siteNum_(r[cols['internet']]) || 0,
      pastDue: siteNum_(r[cols['past due']]) || 0,
    };
    row.vacant = /vacant/i.test(row.status) || /vacant/i.test(row.tenant) || !row.tenant;
    if (row.tenant && !/vacant/i.test(row.tenant)) tenantNames[row.tenant] = true;
    rentByMonth[m].push(row);
  });

  // Monthly Inputs: latest month with ops data entered.
  const mi = ss.getSheetByName('Monthly Inputs').getDataRange().getDisplayValues();
  let inputsLatest = '';
  mi.forEach(function (r) {
    if (/^[A-Z][a-z]{2} \d{4}$/.test(r[0].trim()) && siteNum_(r[3]) > 0) inputsLatest = r[0].trim();
  });

  return { dash: dash, pnlByMonth: pnlByMonth, pnlMonths: months.filter(Boolean),
    rentByMonth: rentByMonth, rentMonths: monthOrder, tenantNames: Object.keys(tenantNames),
    inputsLatest: inputsLatest };
}

function siteReadiness_(sheet, target) {
  const out = [];
  const units = sheet.rentByMonth[target] || [];
  const unitCount = (sheet.rentByMonth[sheet.rentMonths[0]] || []).length;
  if (!units.length) out.push('no Rent Roll rows for ' + target);
  else if (units.length !== unitCount) out.push('Rent Roll has ' + units.length + ' rows for ' + target + ', expected ' + unitCount);
  if (sheet.inputsLatest !== target) out.push('Monthly Inputs latest month is ' + (sheet.inputsLatest || 'blank') + ', not ' + target);
  const p = sheet.pnlByMonth[target];
  if (!p || p.noi === null) out.push('P&L has no NOI for ' + target + ' (QuickBooks not closed or not synced)');
  if (sheet.dash.month !== target) out.push('Dashboard shows ' + (sheet.dash.month || 'blank') + ', not ' + target);
  return out;
}

// ── Build the page JSON ──────────────────────────────────────────────────────

function siteBuildDoc_(sheet, target, prev) {
  const d = sheet.dash;
  const first = sheet.rentByMonth[sheet.rentMonths[0]];
  const firstByUnit = {};
  first.forEach(function (u) { firstByUnit[u.unit] = u; });
  const prevTags = {};
  (prev.rentRoll && prev.rentRoll.units || []).forEach(function (u) { if (u.tag) prevTags[u.unit] = u.tag; });

  // Rent roll: acquisition rent vs target month; vacant units show their last rent.
  const current = sheet.rentByMonth[target].slice().sort(function (a, b) { return Number(a.unit) - Number(b.unit); });
  const targetIdx = sheet.rentMonths.indexOf(target);
  const units = current.map(function (u) {
    const f = firstByUnit[u.unit];
    const label = 'Unit ' + u.unit;
    let out;
    if (u.vacant) {
      let last = f.rent;
      for (let i = targetIdx - 1; i >= 0; i--) {
        const pu = (sheet.rentByMonth[sheet.rentMonths[i]] || []).filter(function (x) { return x.unit === u.unit; })[0];
        if (pu && !pu.vacant && pu.rent) { last = pu.rent; break; }
      }
      out = { unit: label, from: Math.round(f.rent), to: Math.round(last), type: 'vacant' };
    } else {
      const kind = f.tenant !== u.tenant ? 'turned' : (u.rent > f.rent ? 'bump' : 'pending');
      out = { unit: label, from: Math.round(f.rent), to: Math.round(u.rent), type: kind };
    }
    if (prevTags[label] && out.type !== 'vacant') out.tag = prevTags[label];
    return out;
  });
  const occFirst = first.filter(function (u) { return !u.vacant && u.rent; });
  const occNow = current.filter(function (u) { return !u.vacant && u.rent; });
  const avg = function (arr) { return Math.round(arr.reduce(function (s, u) { return s + u.rent; }, 0) / arr.length); };
  const vacantCount = current.length - occNow.length;
  const lateUnits = current.filter(function (u) { return u.pastDue > 0; }).length;

  // NOI series: every month after the partial closing month that has NOI, through target.
  const labels = [], actual = [];
  sheet.pnlMonths.slice(1).forEach(function (m) {
    if (siteMonthIndex_(m) > siteMonthIndex_(target)) return;
    const v = sheet.pnlByMonth[m].noi;
    if (v === null) return;
    labels.push(m.split(' ')[0]);
    actual.push(Math.round(v));
  });

  const basisWord = d.impliedBasis === 'T-3' ? 'trailing-3-month' : 'trailing-12-month';
  let equity = prev.equity || null;
  if (equity && d.implied && d.loan) {
    const profit = d.implied - d.loan - SITE.lpCapital;
    equity = {
      impliedValue: Math.round(d.implied),
      segments: [
        { label: 'Loan payoff', value: Math.round(d.loan), color: 'gray' },
        { label: 'LP capital returned', value: SITE.lpCapital, color: 'blue' },
        { label: 'LP profit share (80%)', value: Math.round(profit * 0.8), color: 'aqua' },
        { label: 'GP promote (20%)', value: Math.round(profit * 0.2), color: 'orange' },
      ],
      note: 'Implied value at a 7% cap on ' + basisWord + ' NOI, before transaction costs. Sale waterfall: loan payoff, LP capital returned in full, then remaining profit split 80% LP / 20% GP.',
    };
  }

  const mon = siteMonthName_(target);
  const noiVar = siteVar_(d.noi, d.noiPF);
  const doc = {
    id: prev.id, name: prev.name, city: prev.city,
    units: current.length,
    asOf: target,
    operatingMonth: d.operatingMonth,
    summary: mon + ' NOI of ' + siteUsd_(d.noi) + ' ran ' + Math.abs(noiVar) + '% ' + (noiVar >= 0 ? 'ahead of' : 'behind') +
      ' pro forma. Trailing-12 NOI is ' + siteAbsPct_(d.t12Var) + (d.t12Var >= 0 ? ' ahead' : ' behind') + ' of plan, occupancy was ' +
      d.occupancy + '% for the month, and the implied value sits ' + Math.round((d.implied / SITE.basis - 1) * 100) + '% above basis.',
    kpis: [
      { label: 'T-12 NOI', value: '$' + (d.t12 / 1000).toFixed(1) + 'K', delta: siteSignPct_(d.t12Var) + ' vs pro forma', good: d.t12Var >= 0 },
      { label: 'Occupancy', value: d.occupancy + '%', delta: vacantCount === 0 ? '0 vacant at month end' : vacantCount + (vacantCount === 1 ? ' unit' : ' units') + ' vacant at month end', good: d.occupancy >= 95 },
      { label: 'Avg scheduled rent', value: '$' + Math.round(d.avgRent), delta: siteSignPct_(d.rentGrowth) + ' since acquisition', good: true },
      { label: 'Delinquency', value: siteUsd_(d.delinquency), delta: lateUnits ? lateUnits + (lateUnits === 1 ? ' unit' : ' units') + ' past due' : 'none past due', good: null },
      { label: 'Cash reserves', value: '$' + (d.reserves / 1000).toFixed(1) + 'K', delta: '', good: null },
      { label: 'Implied value (7% cap)', value: '$' + (d.implied / 1e6).toFixed(2) + 'M',
        delta: siteSignPct_((d.implied / SITE.basis - 1) * 100) + ' vs $' + (SITE.basis / 1e6).toFixed(2) + 'M basis', good: true },
    ],
    noi: {
      labels: labels,
      actual: actual,
      proFormaMonthly: Math.round(d.noiPF),
      note: prev.noi && prev.noi.note || '',
    },
  };
  if (prev.rehab) doc.rehab = prev.rehab;
  if (equity) doc.equity = equity;
  doc.rentRoll = { marketRent: SITE.marketRent, avgFrom: avg(occFirst), avgTo: avg(occNow), units: units };
  doc.highlights = [
    mon + ' NOI ' + siteUsd_(d.noi) + ' vs ' + siteUsd_(d.noiPF) + ' pro forma (' + siteSignPct_(noiVar) + '); trailing-3 NOI annualizes to $' + (d.t3 / 1000).toFixed(1) + 'K.',
    'Revenue ' + siteUsd_(d.income) + ' vs ' + siteUsd_(d.incomePF) + ' pro forma; operating expenses ' + siteUsd_(d.opex) + ' vs ' + siteUsd_(d.opexPF) + '.',
    'Occupancy ' + d.occupancy + '% for the month; ' + (vacantCount === 0 ? 'no vacant units' : vacantCount + (vacantCount === 1 ? ' unit' : ' units') + ' vacant') + ' at month end.',
    'Average rent per occupied unit $' + Math.round(d.avgRent) + ', up ' + d.rentGrowth + '% since acquisition.',
    'Cash reserves ' + siteUsd_(d.reserves) + '; ' + siteUsd_(d.principalCum) + ' of principal paid down since acquisition.',
    'LP distributions paid to date: ' + siteUsd_(d.distributions) + '.',
  ];
  return doc;
}

// The numeric content of a page doc, for "did anything actually change" comparisons.
function siteNumbersOf_(doc) {
  return JSON.stringify({
    asOf: doc.asOf,
    kpis: (doc.kpis || []).map(function (k) { return k.value; }),
    noi: doc.noi && [doc.noi.actual, doc.noi.proFormaMonthly],
    equity: doc.equity && doc.equity.segments.map(function (s) { return s.value; }),
    rent: doc.rentRoll && doc.rentRoll.units.map(function (u) { return [u.unit, u.from, u.to, u.type]; }),
  });
}

// ── Verification ─────────────────────────────────────────────────────────────

function siteVerify_(doc, prev, sheet, target) {
  const p = [];
  const d = sheet.dash;
  const prevIdx = siteMonthIndex_(prev.asOf), tIdx = siteMonthIndex_(target);

  if (tIdx < prevIdx) p.push('Target ' + target + ' is older than the published ' + prev.asOf + '.');
  if (tIdx > prevIdx + 1) p.push('Skipping months: site is at ' + prev.asOf + ', sheet is at ' + target + '.');

  // Shape.
  if (doc.kpis.some(function (k) { return !k.value || /NaN|undefined|null/.test(k.value + k.delta); })) p.push('A KPI came out blank or NaN: ' + JSON.stringify(doc.kpis));
  if (doc.noi.labels.length !== doc.noi.actual.length) p.push('NOI labels and values differ in length.');
  if (doc.noi.labels[doc.noi.labels.length - 1] !== siteMonthName_(target).slice(0, 3)) p.push('NOI chart does not end at ' + target + '.');
  if (doc.units !== prev.units) p.push('Unit count changed from ' + prev.units + ' to ' + doc.units + '.');

  // Rent roll.
  const rr = sheet.rentByMonth[target];
  const seen = {};
  rr.forEach(function (u) {
    if (seen[u.unit]) p.push('Rent Roll lists unit ' + u.unit + ' twice for ' + target + '.');
    seen[u.unit] = true;
    if (!u.vacant && !(u.rent >= 400 && u.rent <= 2000)) p.push('Unit ' + u.unit + ' rent $' + u.rent + ' is outside $400-$2,000.');
  });
  if (!(d.occupancy >= 75 && d.occupancy <= 100)) p.push('Occupancy ' + d.occupancy + '% is outside 75-100%.');

  // NOI vs recent history.
  const hist = doc.noi.actual.slice(0, -1).slice(-6);
  const med = siteMedian_(hist);
  const noi = doc.noi.actual[doc.noi.actual.length - 1];
  if (!(noi > 0)) p.push(target + ' NOI is ' + noi + '.');
  else if (med && (noi < med * 0.5 || noi > med * 1.6)) p.push(target + ' NOI ' + siteUsd_(noi) + ' is far from the 6-month median ' + siteUsd_(med) + ' (allowed 50%-160%).');
  if (Math.abs(noi - d.noi) > 1) p.push('Dashboard NOI ' + siteUsd_(d.noi) + ' does not match P&L NOI ' + siteUsd_(noi) + '.');

  // Revenue vs what the rent roll billed.
  const billed = rr.reduce(function (s, u) { return s + (u.vacant ? 0 : (u.rent || 0) + u.rubs + u.pet + u.internet); }, 0);
  const inc = sheet.pnlByMonth[target].income;
  if (billed && inc !== null && Math.abs(inc / billed - 1) > 0.3) p.push(target + ' revenue ' + siteUsd_(inc) + ' is more than 30% away from rent-roll billings ' + siteUsd_(billed) + '.');

  // Already-published months should not move (QuickBooks restatements).
  const prevMap = {};
  (prev.noi.labels || []).forEach(function (l, i) { prevMap[l + '#' + i] = prev.noi.actual[i]; });
  prev.noi.labels.forEach(function (l, i) {
    if (doc.noi.labels[i] !== l) { p.push('NOI month order changed at position ' + (i + 1) + ' (' + l + ' became ' + doc.noi.labels[i] + ').'); return; }
    const a = prev.noi.actual[i], b = doc.noi.actual[i];
    if (Math.abs(b - a) > Math.max(300, Math.abs(a) * 0.02)) p.push('Published ' + l + ' NOI moved from ' + siteUsd_(a) + ' to ' + siteUsd_(b) + ' (QuickBooks restatement?).');
  });

  // Drift vs last published snapshot.
  const prevEq = prev.equity || {};
  if (prevEq.impliedValue && Math.abs(d.implied / prevEq.impliedValue - 1) > 0.2) p.push('Implied value moved from ' + siteUsd_(prevEq.impliedValue) + ' to ' + siteUsd_(d.implied) + ' (more than 20%).');
  const prevLoan = (prevEq.segments || []).filter(function (s) { return s.label === 'Loan payoff'; })[0];
  if (prevLoan && !(d.loan <= prevLoan.value + 1 && d.loan > prevLoan.value - 5000)) p.push('Loan balance went from ' + siteUsd_(prevLoan.value) + ' to ' + siteUsd_(d.loan) + ' (expected a small paydown).');
  if (!(d.reserves >= 0)) p.push('Cash reserves are ' + siteUsd_(d.reserves) + '.');
  if (d.delinquency > 10000) p.push('Delinquency is ' + siteUsd_(d.delinquency) + '.');
  const prevT12 = siteNum_(String((prev.kpis[0] || {}).value || '').replace(/K$/, ''));
  if (prevT12 && Math.abs(d.t12 / (prevT12 * 1000) - 1) > 0.25) p.push('T-12 NOI moved from $' + prevT12 + 'K to $' + (d.t12 / 1000).toFixed(1) + 'K (more than 25%).');

  // Privacy.
  const names = siteTenantNamesIn_(JSON.stringify(doc), sheet.tenantNames);
  if (names.length) p.push('Tenant name(s) in the page data: ' + names.join(', ') + '.');
  return p;
}

// ── Update-email archive ─────────────────────────────────────────────────────

function siteFindNewUpdateEmail_(archive) {
  const have = {};
  let newest = '';
  archive.updates.forEach(function (u) { have[u.title] = true; if (u.sentDate > newest) newest = u.sentDate; });
  const threads = GmailApp.search('subject:"' + SITE.emailSubjectPrefix + '" from:adam@bidwellcapitalfund.com newer_than:45d', 0, 20);
  const found = [];
  threads.forEach(function (t) {
    t.getMessages().forEach(function (m) {
      const subj = m.getSubject();
      if (subj.indexOf(SITE.emailSubjectPrefix) !== 0 || !/Update$/.test(subj) || have[subj]) return;
      if (!/adam@bidwellcapitalfund\.com/i.test(m.getFrom())) return;
      if (/preview\.kit-mail/i.test(m.getHeader('List-Unsubscribe') || '')) return;  // Kit test send
      const sent = Utilities.formatDate(m.getDate(), SITE.tz, 'yyyy-MM-dd');
      if (sent <= newest) return;
      const html = siteEmailToHtml_(m.getPlainBody());
      if (html) found.push({ title: subj, sentDate: sent, html: html });
    });
  });
  found.sort(function (a, b) { return a.sentDate < b.sentDate ? -1 : 1; });
  return found[0] || null;  // oldest first; the next daily run picks up any further ones
}

// Kit plain-text body -> the archive's minimal HTML: <p><strong>Heading</strong></p>, <p>, <ul><li>.
// Keeps "Below is the update ..." through the closing line; drops greeting, Document Access, footer.
function siteEmailToHtml_(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const start = lines.findIndex(function (l) { return /^Below is the update/.test(l.trim()); });
  if (start < 0) return '';
  let end = lines.findIndex(function (l, i) { return i > start && (/^-->/.test(l.trim()) || /^-{3,}$/.test(l.trim())); });
  if (end < 0) end = lines.length;
  const blocks = [];
  let cur = [];
  lines.slice(start, end).forEach(function (l) {
    const s = l.trim().replace(/\s*\(\s*https?:\/\/[^)]*\)/g, '');
    if (!s) { if (cur.length) blocks.push(cur); cur = []; } else cur.push(s);
  });
  if (cur.length) blocks.push(cur);
  const esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  let html = '';
  let skipNext = false;
  blocks.forEach(function (b) {
    if (skipNext) { skipNext = false; return; }
    if (b.length === 1 && /^Document Access$/i.test(b[0])) { skipNext = true; return; }
    if (b.every(function (l) { return /^[*•]\s/.test(l); })) {
      html += '<ul>' + b.map(function (l) { return '<li>' + esc(l.replace(/^[*•]\s+/, '')) + '</li>'; }).join('') + '</ul>';
    } else if (b.length === 1 && b[0].length < 60 && !/[.!?:]$/.test(b[0])) {
      html += '<p><strong>' + esc(b[0]) + '</strong></p>';
    } else {
      html += '<p>' + esc(b.join(' ')) + '</p>';
    }
  });
  return html;
}

function siteTenantNamesIn_(text, names) {
  const stop = { chat: 1, vacant: 1, angel: 1, justice: 1, fields: 1, jade: 1, unit: 1 };
  const hits = {};
  const hay = ' ' + text.toLowerCase().replace(/<[^>]+>/g, ' ') + ' ';
  names.forEach(function (n) {
    n.split(/[\s&,\-]+/).forEach(function (tok) {
      const t = tok.toLowerCase().replace(/[^a-z']/g, '');
      if (t.length < 4 || stop[t]) return;
      if (new RegExp('[^a-z]' + t + '[^a-z]').test(hay)) hits[n] = true;
    });
  });
  return Object.keys(hits);
}

// ── GitHub ───────────────────────────────────────────────────────────────────

function siteGh_(method, path, payload) {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('No GITHUB_TOKEN. Use Website > Set GitHub token.');
  const res = UrlFetchApp.fetch('https://api.github.com' + path, {
    method: method,
    contentType: 'application/json',
    payload: payload ? JSON.stringify(payload) : undefined,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  const text = res.getContentText();
  if (code < 200 || code >= 300) throw new Error(method + ' ' + path + ' -> HTTP ' + code + ': ' + text.slice(0, 300));
  return text ? JSON.parse(text) : {};
}

function siteGhFile_(path) {
  const f = siteGh_('GET', '/repos/' + SITE.owner + '/' + SITE.repo + '/contents/' + path + '?ref=' + SITE.branch);
  const bytes = Utilities.base64Decode(f.content.replace(/\n/g, ''));
  return { sha: f.sha, text: Utilities.newBlob(bytes).getDataAsString('UTF-8') };
}

// One commit with every changed file on a fresh branch, PR, squash merge, delete branch.
function siteGhPublish_(files, title, body) {
  const repo = '/repos/' + SITE.owner + '/' + SITE.repo;
  const baseSha = siteGh_('GET', repo + '/git/ref/heads/' + SITE.branch).object.sha;
  const baseTree = siteGh_('GET', repo + '/git/commits/' + baseSha).tree.sha;
  const tree = siteGh_('POST', repo + '/git/trees', {
    base_tree: baseTree,
    tree: Object.keys(files).map(function (p) { return { path: p, mode: '100644', type: 'blob', content: files[p] }; }),
  });
  const commit = siteGh_('POST', repo + '/git/commits', { message: title, tree: tree.sha, parents: [baseSha] });
  const branch = 'auto/cherry-' + Utilities.formatDate(new Date(), SITE.tz, 'yyyyMMdd-HHmm');
  siteGh_('POST', repo + '/git/refs', { ref: 'refs/heads/' + branch, sha: commit.sha });
  const pr = siteGh_('POST', repo + '/pulls', { title: title, head: branch, base: SITE.branch, body: body });
  siteGh_('PUT', repo + '/pulls/' + pr.number + '/merge', { merge_method: 'squash', commit_title: title + ' (#' + pr.number + ')' });
  try { siteGh_('DELETE', repo + '/git/refs/heads/' + branch); } catch (e) { /* branch cleanup is best effort */ }
  return pr.html_url;
}

function siteChangeSummary_(doc, prev, email, log, problems, forced) {
  const lines = ['Automated publish from the 946 Cherry Asset Mgmt sheet (Website > daily sync).', ''];
  if (doc) {
    lines.push('| | Published | New |', '|---|---|---|', '| Month | ' + prev.asOf + ' | ' + doc.asOf + ' |');
    doc.kpis.forEach(function (k, i) {
      const o = prev.kpis[i] || {};
      lines.push('| ' + k.label + ' | ' + (o.value || '') + ' | ' + k.value + ' |');
    });
    lines.push('');
  }
  if (email) lines.push('Adds "' + email.title + '" (' + email.sentDate + ') to the update archive.', '');
  if (forced) lines.push('**Checks overridden by hand:**', '', problems.map(function (p) { return '- ' + p; }).join('\n'), '');
  else lines.push('All verification checks passed.', '');
  lines.push('Run log:', '', log.map(function (l) { return '- ' + l; }).join('\n'));
  return lines.join('\n');
}

// ── Alerts / UI ──────────────────────────────────────────────────────────────

function siteAlertEmail_() {
  return PropertiesService.getScriptProperties().getProperty('SITE_ALERT_EMAIL') || Session.getEffectiveUser().getEmail();
}

function siteEarliestDay_() {
  return Number(PropertiesService.getScriptProperties().getProperty('SITE_EARLIEST_DAY')) || SITE.earliestDay;
}

// Emails once per distinct problem set, and again if it is still unresolved after 3 days.
function siteAlert_(subject, problems, log) {
  const props = PropertiesService.getScriptProperties();
  const hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, subject + problems.join('|')));
  const lastAt = Number(props.getProperty('SITE_ALERT_AT')) || 0;
  if (props.getProperty('SITE_ALERT_HASH') === hash && Date.now() - lastAt < 3 * 24 * 3600 * 1000) return;
  const esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  const sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const html = '<p>The Cherry 20 website sync stopped before publishing.</p>' +
    '<ul>' + problems.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' +
    '<p>Fix the sheet and the next daily run retries, or use Website &gt; Publish now (override checks) in the <a href="' + sheetUrl + '">946 Cherry Asset Mgmt sheet</a> if the numbers are right.</p>' +
    (log && log.length ? '<p>Run log:</p><ul>' + log.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' : '');
  MailApp.sendEmail({ to: siteAlertEmail_(), subject: subject, htmlBody: html, name: 'Cherry 20 website sync' });
  props.setProperty('SITE_ALERT_HASH', hash);
  props.setProperty('SITE_ALERT_AT', String(Date.now()));
}

function siteShow_(title, res) {
  const parts = [];
  if (res.problems.length) parts.push('Problems:\n' + res.problems.map(function (p) { return '• ' + p; }).join('\n'));
  parts.push(res.published ? 'Published: ' + res.pr : (res.changed.length ? 'Would change: ' + res.changed.join(', ') : 'Nothing to change.'));
  parts.push('Log:\n' + res.log.map(function (l) { return '• ' + l; }).join('\n'));
  SpreadsheetApp.getUi().alert(title, parts.join('\n\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

// ── Small helpers ────────────────────────────────────────────────────────────

function sitePrevMonth_(d) {
  const y = Number(Utilities.formatDate(d, SITE.tz, 'yyyy'));
  const m = Number(Utilities.formatDate(d, SITE.tz, 'M'));
  const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y;
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][pm - 1] + ' ' + py;
}

function siteSyncRange_(target) {
  const start = PropertiesService.getScriptProperties().getProperty('QB_START_MONTH') || '2025-08';
  const d = monthLabelToDate(target);
  return { start: start + '-01', end: formatYmd(endOfMonth(d)) };
}

function siteMonthIndex_(label) {
  const m = String(label || '').match(/^([A-Za-z]{3})\s+(\d{4})$/);
  return m ? Number(m[2]) * 12 + parseMonthName(m[1]) : -1;
}

function siteMonthName_(label) {
  const full = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return full[parseMonthName(label.split(' ')[0])];
}

function siteNum_(s) {
  if (s === null || s === undefined) return null;
  const t = String(s).replace(/[$,%x\s]/g, '');
  if (t === '' || t === '-') return null;
  const neg = /^\(.*\)$/.test(t);
  const n = Number(t.replace(/[()]/g, ''));
  return isNaN(n) ? null : (neg ? -n : n);
}

function siteRaw_(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : siteNum_(v);
  return n === null || isNaN(n) ? null : n;
}

function siteMedian_(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort(function (a, b) { return a - b; });
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

function siteVar_(a, b) { return b ? Math.round((a / b - 1) * 100) : 0; }
function siteUsd_(n) { return (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US'); }
function siteSignPct_(n) { return (n >= 0 ? '+' : '-') + Math.abs(Math.round(n)) + '%'; }
function siteAbsPct_(n) { return Math.abs(Math.round(n)) + '%'; }
