/**
 * Rendering functions for summary, cashflow, tax, Gantt, table, and proforma outputs.
 */

/* ==========================================================
   RENDER: EXECUTIVE SUMMARY
   ========================================================== */

function renderSummary(data, summaryCard) {
  var modeLabel = data.mode === 'overlap'
    ? 'Overlapped (' + data.overlapOffset + 'd offset)' : 'Sequential';
  var weatherNote = data.weatherEnabled
    ? '<span class="weather-delay-badge">+' + data.totalWeatherDays + 'd weather</span>' : '';

  summaryCard.innerHTML =
    '<div class="summary-item"><div class="summary-item-label">Project Start</div><div class="summary-item-value">' + formatDate(data.startDate) + '</div></div>' +
    '<div class="summary-item"><div class="summary-item-label">Wells</div><div class="summary-item-value">' + data.numWells + '</div></div>' +
    '<div class="summary-item"><div class="summary-item-label">Drilling Mode</div><div class="summary-item-value">' + modeLabel + '</div></div>' +
    '<div class="summary-item"><div class="summary-item-label">Est. First Production</div><div class="summary-item-value">' + formatDate(data.firstProductionDate) + '</div></div>' +
    '<div class="summary-item"><div class="summary-item-label">Final Stabilized</div><div class="summary-item-value">' + formatDate(data.finalStabilizedDate) + '</div></div>' +
    '<div class="summary-item"><div class="summary-item-label">Total Duration</div><div class="summary-item-value">' + data.totalDays + ' days' + weatherNote + '</div></div>';
}

/* ==========================================================
   RENDER: CASHFLOW
   ========================================================== */

function renderCashflow(data, container, cashflowCard) {
  if (!data.firstProductionMonth) {
    if (cashflowCard) cashflowCard.style.display = 'none';
    return;
  }
  if (cashflowCard) cashflowCard.style.display = 'block';

  var html =
    '<div class="info-metric"><div class="info-metric-label">First Production</div><div class="info-metric-value">' + formatDate(data.firstProductionDate) + '</div></div>' +
    '<div class="info-metric"><div class="info-metric-label">First Distribution Check</div><div class="info-metric-value highlight-green">' + formatDate(data.firstDistDate) + '</div>' +
    '<div class="info-metric-note">' + data.distLag + '-month lag from production</div></div>' +
    '<div class="info-metric"><div class="info-metric-label">All Wells Stabilized</div><div class="info-metric-value">' + formatDate(data.finalStabilizedDate) + '</div></div>' +
    '<div class="info-metric"><div class="info-metric-label">Last Production Period Check</div><div class="info-metric-value">' + formatDate(data.lastProductionCheck) + '</div>' +
    '<div class="info-metric-note">Check for final stabilization month</div></div>';

  if (data.wellFlowbackDates.length > 0) {
    html += '<div class="info-metric" style="grid-column:1/-1;"><div class="info-metric-label">Per-Well Production &amp; First Distribution</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.35rem;margin-top:0.35rem;">';
    for (var i = 0; i < data.wellFlowbackDates.length; i++) {
      var wf = data.wellFlowbackDates[i];
      var distDate = addMonths(new Date(wf.date.getFullYear(), wf.date.getMonth(), 1), data.distLag);
      html += '<div style="font-size:0.75rem;color:#3a3a4a;"><strong>' + wf.well + '</strong>: flows ' + formatShortDate(wf.date) + ' → check ' + formatShortDate(distDate) + '</div>';
    }
    html += '</div></div>';
  }

  container.innerHTML = html;
}

/* ==========================================================
   RENDER: TAX DEDUCTION
   ========================================================== */

function renderTax(data, container, taxCard) {
  if (data.totalInvestment <= 0) {
    if (taxCard) taxCard.style.display = 'none';
    return;
  }
  if (taxCard) taxCard.style.display = 'block';

  var invYearStr = String(data.investmentYear);
  var tdcInvestmentYear = data.tdcByYear[invYearStr] ? data.tdcByYear[invYearStr].bonusDepr : 0;
  var investmentYearDeduction = data.idcQualifyingAmount + tdcInvestmentYear;
  var investmentYearPct = data.totalInvestment > 0 ? Math.round((investmentYearDeduction / data.totalInvestment) * 100) : 0;

  var html =
    '<div class="info-metric"><div class="info-metric-label">Total Investment</div><div class="info-metric-value">' + formatCurrency(data.totalInvestment) + '</div></div>' +
    '<div class="info-metric"><div class="info-metric-label">IDC (' + data.idcPct + '%)</div><div class="info-metric-value">' + formatCurrency(data.idcAmount) + '</div>' +
    '<div class="info-metric-note">' + formatCurrency(data.idcPerWell) + ' per well — deductible in year invested</div></div>' +
    '<div class="info-metric"><div class="info-metric-label">TDC (' + data.tdcPct + '%)</div><div class="info-metric-value">' + formatCurrency(data.tdcAmount) + '</div>' +
    '<div class="info-metric-note">' + formatCurrency(data.tdcPerWell) + ' per well — deductible year well goes into service</div></div>' +
    '<div class="info-metric"><div class="info-metric-label">Overhead (' + data.overheadPct + '%)</div><div class="info-metric-value">' + formatCurrency(data.overheadAmount) + '</div></div>' +
    '<div class="info-metric"><div class="info-metric-label">Bonus Depreciation (' + data.bonusDeprPct + '%)</div><div class="info-metric-value">' + formatCurrency(data.bonusDeprAmount) + '</div>' +
    '<div class="info-metric-note">Applied to TDC in the year each well flows</div></div>';

  if (data.remainingTdc > 0) {
    html += '<div class="info-metric"><div class="info-metric-label">Remaining TDC (MACRS)</div><div class="info-metric-value">' + formatCurrency(data.remainingTdc) + '</div>' +
      '<div class="info-metric-note">Depreciated over 7-year schedule per well</div></div>';
  }

  html += '<div class="info-metric" style="grid-column:1/-1;"><div class="info-metric-label">TDC Deduction by Year (in service)</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.5rem;margin-top:0.35rem;">';
  for (var yi = 0; yi < data.tdcYears.length; yi++) {
    var yr = data.tdcYears[yi];
    var yd = data.tdcByYear[yr];
    var wellList = yd.wells.length > 0 ? yd.wells.join(', ') : 'All';
    html += '<div style="background:#f9f9fb;border:1px solid #e5e5ea;border-radius:6px;padding:0.6rem 0.75rem;">' +
      '<div style="font-size:0.6875rem;font-weight:600;color:#1a1a2e;">' + yr + '</div>' +
      '<div style="font-size:0.875rem;font-weight:500;color:#1a1a2e;">' + formatCurrency(yd.bonusDepr) + ' bonus depr</div>';
    if (yd.remaining > 0) {
      html += '<div style="font-size:0.75rem;color:#6b6b80;">' + formatCurrency(yd.remaining) + ' MACRS</div>';
    }
    html += '<div style="font-size:0.6875rem;color:#9b9ba8;">' + wellList + '</div></div>';
  }
  html += '</div></div>';

  html += '<div class="info-metric"><div class="info-metric-label">' + data.investmentYear + ' Total Deduction</div><div class="info-metric-value highlight-green">' + formatCurrency(investmentYearDeduction) + ' (' + investmentYearPct + '%)</div>' +
    '<div class="info-metric-note">Qualifying IDC + bonus depreciation on TDC in service ' + data.investmentYear + '</div></div>';

  var idcSummaryClass, idcSummaryText;
  if (data.allQualify) {
    idcSummaryClass = 'highlight-green';
    idcSummaryText = 'All ' + data.numWells + ' wells qualify — spud by ' + formatDate(data.march31Deadline);
  } else if (data.noneQualify) {
    idcSummaryClass = 'highlight-red';
    idcSummaryText = 'No wells qualify — none spudded by ' + formatDate(data.march31Deadline);
  } else {
    idcSummaryClass = 'highlight-amber';
    idcSummaryText = data.wellsQualifying + ' of ' + data.numWells + ' wells qualify (' + formatCurrency(data.idcQualifyingAmount) + ' deductible in ' + data.investmentYear + ')';
  }

  html += '<div class="info-metric" style="grid-column:1/-1;"><div class="info-metric-label">IDC Deduction Status — Must spud by ' + formatDate(data.march31Deadline) + '</div>' +
    '<div class="info-metric-value ' + idcSummaryClass + '" style="font-size:0.8125rem;">' + idcSummaryText + '</div></div>';

  if (!data.allQualify && data.wellIdcStatus.length > 0) {
    html += '<div style="grid-column:1/-1;margin-top:0.25rem;"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.35rem;">';
    for (var i = 0; i < data.wellIdcStatus.length; i++) {
      var ws = data.wellIdcStatus[i];
      var statusIcon = ws.qualifies ? '&#10003;' : '&#10007;';
      var statusColor = ws.qualifies ? '#059669' : '#dc2626';
      var spudStr = ws.spudDate ? formatShortDate(ws.spudDate) : 'N/A';
      html += '<div style="font-size:0.75rem;color:' + statusColor + ';"><strong>' + ws.well + '</strong>: spud ' + spudStr + ' ' + statusIcon + ' (' + formatCurrency(ws.idcShare) + ')</div>';
    }
    html += '</div></div>';
  }

  if (data.idcNonQualifyingAmount > 0) {
    html += '<div class="info-metric" style="grid-column:1/-1;"><div class="info-metric-label">Non-Qualifying IDC</div>' +
      '<div class="info-metric-value highlight-red">' + formatCurrency(data.idcNonQualifyingAmount) + '</div>' +
      '<div class="info-metric-note">' + data.wellsNotQualifying + ' well' + (data.wellsNotQualifying > 1 ? 's' : '') + ' spudded after deadline — IDC deferred to spud year</div></div>';
  }

  container.innerHTML = html;
}

/* ==========================================================
   RENDER: GANTT LEGEND
   ========================================================== */

function renderLegend(ganttLegend) {
  var html = '';
  for (var i = 0; i < LEGEND_ITEMS.length; i++) {
    html += '<div class="gantt-legend-item"><span class="gantt-legend-swatch" style="background:' + LEGEND_ITEMS[i].color + ';"></span>' + LEGEND_ITEMS[i].label + '</div>';
  }
  ganttLegend.innerHTML = html;
}

/* ==========================================================
   RENDER: GANTT CHART
   ========================================================== */

function renderGantt(data, container, forPdf, displayOpts) {
  var showMilestones = displayOpts.milestones;
  var showLabels = displayOpts.labels;
  var showWeekends = displayOpts.weekends;
  var showToday = displayOpts.today;
  var compact = displayOpts.compact;
  var summaryView = displayOpts.summaryView;
  var consolidatedView = displayOpts.consolidated;

  if (!forPdf) {
    document.body.classList.toggle('compact', compact);
  }

  var autoCompact = data.numWells >= 8 && !summaryView;
  var effectiveCompact = compact || autoCompact;
  var rowHeight = consolidatedView ? 36 : (summaryView ? 28 : (effectiveCompact ? 20 : 30));
  var labelWidth = showLabels ? (summaryView ? 100 : 180) : 0;
  var headerHeight = 24;

  if (forPdf) {
    showLabels = true; showToday = false; showWeekends = false;
    summaryView = data.numWells > 6;
    rowHeight = summaryView ? 24 : 20;
    labelWidth = summaryView ? 90 : 160;
    effectiveCompact = true;
  }

  var rows = [];

  if (consolidatedView) {
    var categoryOrder = ['Pre-drill / Permitting', 'Drilling', 'Completion Prep', 'Facilities', 'Frac & Completion', 'Production'];
    var categoryKeys = {
      'Pre-drill / Permitting': ['preDrill'], 'Drilling': ['rigMob', 'sitePrep', 'drillSurface', 'drillTD', 'logEval', 'runCasing'],
      'Completion Prep': ['perforate', 'acidize', 'swabTest'], 'Facilities': ['facilities'],
      'Frac & Completion': ['fracBuffer', 'fracExec', 'drillOut'], 'Production': ['flowback', 'stabilized']
    };
    var categoryColors = {
      'Pre-drill / Permitting': '#94a3b8', 'Drilling': '#3b82f6', 'Completion Prep': '#f59e0b',
      'Facilities': '#8b5cf6', 'Frac & Completion': '#10b981', 'Production': '#065f46'
    };

    for (var ci = 0; ci < categoryOrder.length; ci++) {
      var catName = categoryOrder[ci];
      var catKeys = categoryKeys[catName];
      var catBars = [];
      for (var cb = 0; cb < data.allBars.length; cb++) {
        if (catKeys.indexOf(data.allBars[cb].key) !== -1) catBars.push(data.allBars[cb]);
      }
      if (catBars.length > 0) {
        var wellBars = {};
        for (var wb = 0; wb < catBars.length; wb++) {
          var wn = catBars[wb].well;
          if (!wellBars[wn]) wellBars[wn] = { start: catBars[wb].start, end: catBars[wb].end, well: wn };
          else {
            if (catBars[wb].start < wellBars[wn].start) wellBars[wn].start = catBars[wb].start;
            if (catBars[wb].end > wellBars[wn].end) wellBars[wn].end = catBars[wb].end;
          }
        }
        var mergedBars = [];
        var wellKeys = Object.keys(wellBars);
        for (var mk = 0; mk < wellKeys.length; mk++) {
          var mb = wellBars[wellKeys[mk]];
          mergedBars.push({
            key: catKeys[0], name: catName, color: categoryColors[catName],
            category: catName, well: mb.well,
            start: mb.start, end: mb.end, duration: daysBetween(mb.start, mb.end) + 1
          });
        }
        rows.push({ type: 'phase', label: catName, bars: mergedBars, isConsolidated: true });
      }
    }
  } else if (summaryView) {
    if (data.projectPhases.length > 0) {
      rows.push({ type: 'phase', label: 'Project', bars: data.projectPhases, isProject: true });
    }
    for (var sw = 0; sw < data.wells.length; sw++) {
      rows.push({ type: 'phase', label: data.wellNames[sw], bars: data.wells[sw], isSummary: true });
    }
  } else {
    if (data.projectPhases.length > 0) {
      rows.push({ type: 'header', label: 'Project-Wide', bars: [] });
      for (var pp = 0; pp < data.projectPhases.length; pp++) {
        rows.push({ type: 'phase', label: data.projectPhases[pp].name, bars: [data.projectPhases[pp]], isProject: true });
      }
    }
    for (var w = 0; w < data.wells.length; w++) {
      rows.push({ type: 'header', label: data.wellNames[w], bars: [] });
      var phases = data.wells[w];
      for (var p = 0; p < phases.length; p++) {
        rows.push({ type: 'phase', label: phases[p].name, bars: [phases[p]] });
      }
    }
  }

  var minDate = data.startDate;
  var maxDate = data.endDate;
  var totalDays = daysBetween(minDate, maxDate) + 1;
  var availWidth = (forPdf ? 900 : container.clientWidth) - labelWidth - 20;
  var pxPerDay = Math.max(availWidth / totalDays, forPdf ? 2 : 4);
  if (!forPdf && totalDays < 60) pxPerDay = Math.min(Math.max(pxPerDay, 12), 20);
  var chartWidth = totalDays * pxPerDay;

  var tickIntervalDays;
  if (totalDays <= 60) tickIntervalDays = 7;
  else if (totalDays <= 120) tickIntervalDays = 14;
  else tickIntervalDays = 30;

  var html = '<div class="gantt-wrapper">';

  if (showLabels) {
    html += '<div class="gantt-labels" style="width:' + labelWidth + 'px;">';
    html += '<div style="height:' + headerHeight + 'px;border-bottom:1px solid #e5e5ea;"></div>';
    for (var r = 0; r < rows.length; r++) {
      var cls = rows[r].type === 'header' ? 'gantt-label-row well-header' : 'gantt-label-row';
      if (rows[r].isProject) cls += ' project-phase';
      if (rows[r].isConsolidated) cls += ' consolidated-category';
      html += '<div class="' + cls + '" style="height:' + rowHeight + 'px;">' + rows[r].label + '</div>';
    }
    html += '</div>';
  }

  html += '<div class="gantt-chart-area" style="width:' + chartWidth + 'px;">';
  html += '<div class="gantt-header" style="height:' + headerHeight + 'px;">';
  for (var t = 0; t < totalDays; t += tickIntervalDays) {
    var tickDate = addDays(minDate, t);
    var tickLeft = t * pxPerDay;
    var tickWidth = Math.min(tickIntervalDays, totalDays - t) * pxPerDay;
    html += '<div class="gantt-tick" style="position:absolute;left:' + tickLeft + 'px;width:' + tickWidth + 'px;height:' + headerHeight + 'px;line-height:' + headerHeight + 'px;">' + formatShortDate(tickDate) + '</div>';
  }
  html += '</div>';

  html += '<div class="gantt-rows" style="position:relative;">';

  if (showWeekends) {
    for (var wd = 0; wd < totalDays; wd++) {
      var checkDate = addDays(minDate, wd);
      if (isWeekend(checkDate)) {
        html += '<div class="gantt-weekend" style="left:' + (wd * pxPerDay) + 'px;width:' + pxPerDay + 'px;height:' + (rows.length * rowHeight) + 'px;"></div>';
      }
    }
  }

  var barHeight = summaryView ? 18 : (effectiveCompact ? 14 : 20);

  for (var r2 = 0; r2 < rows.length; r2++) {
    var row = rows[r2];
    var rowCls = 'gantt-row' + (row.type === 'header' ? ' well-header-row' : '');
    html += '<div class="' + rowCls + '" style="height:' + rowHeight + 'px;">';

    for (var b = 0; b < row.bars.length; b++) {
      var bar = row.bars[b];
      var barLeft = daysBetween(minDate, bar.start) * pxPerDay;
      var barWidth = Math.max(bar.duration * pxPerDay, 2);
      var barTop = Math.round((rowHeight - barHeight) / 2);
      var extraClass = row.isSummary ? ' summary-bar' : (row.isConsolidated ? ' consolidated-bar' : '');

      html += '<div class="gantt-bar' + extraClass + '" style="left:' + barLeft + 'px;width:' + barWidth + 'px;top:' + barTop + 'px;height:' + barHeight + 'px;background:' + bar.color + ';"' +
        ' data-tt-name="' + escapeAttr(bar.name) + '"' +
        ' data-tt-well="' + escapeAttr(bar.well) + '"' +
        ' data-tt-start="' + formatDate(bar.start) + '"' +
        ' data-tt-end="' + formatDate(bar.end) + '"' +
        ' data-tt-dur="' + bar.duration + ' days' + (bar.weatherDays > 0 ? ' (incl. ' + bar.weatherDays + 'd weather)' : '') + '"' +
        '></div>';

      if (showMilestones && bar.key === 'stabilized') {
        html += '<div class="gantt-milestone" style="left:' + (barLeft + barWidth) + 'px;"></div>';
      }
    }

    html += '</div>';
  }

  if (showToday) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var todayOffset = daysBetween(minDate, today);
    if (todayOffset >= 0 && todayOffset <= totalDays) {
      html += '<div class="gantt-today-line" style="left:' + (todayOffset * pxPerDay) + 'px;height:' + (rows.length * rowHeight) + 'px;"><span class="gantt-today-label">Today</span></div>';
    }
  }

  html += '</div></div></div>';
  container.innerHTML = html;
}

/* ==========================================================
   RENDER: SCHEDULE TABLE
   ========================================================== */

function renderTable(data, container) {
  var html = '<table class="schedule-table"><thead><tr>' +
    '<th>Well</th><th>Phase</th><th>Start Date</th><th>End Date</th><th>Duration</th>' +
    '</tr></thead><tbody>';

  if (data.projectPhases.length > 0) {
    html += '<tr class="well-divider"><td colspan="5">Project-Wide</td></tr>';
    for (var pp = 0; pp < data.projectPhases.length; pp++) {
      var p = data.projectPhases[pp];
      var pDurStr = p.duration + 'd';
      if (p.weatherDays > 0) pDurStr += ' <span class="weather-delay-badge">+' + p.weatherDays + 'd</span>';
      html += '<tr><td>Project</td><td><span class="phase-color" style="background:' + p.color + ';"></span>' + p.name + '</td><td>' + formatDate(p.start) + '</td><td>' + formatDate(p.end) + '</td><td>' + pDurStr + '</td></tr>';
    }
  }

  for (var w = 0; w < data.wells.length; w++) {
    var wn = data.wellNames[w];
    html += '<tr class="well-divider"><td colspan="5">' + wn + '</td></tr>';
    for (var ph = 0; ph < data.wells[w].length; ph++) {
      var phase = data.wells[w][ph];
      var durStr = phase.duration + 'd';
      if (phase.weatherDays > 0) durStr += ' <span class="weather-delay-badge">+' + phase.weatherDays + 'd</span>';
      html += '<tr><td>' + wn + '</td><td><span class="phase-color" style="background:' + phase.color + ';"></span>' + phase.name + '</td><td>' + formatDate(phase.start) + '</td><td>' + formatDate(phase.end) + '</td><td>' + durStr + '</td></tr>';
    }
  }

  html += '</tbody></table>';
  container.innerHTML = html;
}

/* ==========================================================
   RENDER: PROFORMA OUTPUT
   ========================================================== */

function renderProformaOutput(wellProformas, fundRollup, globals, container) {
  if (!wellProformas || wellProformas.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  var g = Object.assign({}, PROFORMA_DEFAULTS, globals || {});
  var years = g.projectionYears || 10;

  var html = '';

  // Fund-level summary card
  html += '<div class="proforma-fund-summary">';
  html += '<div class="proforma-fund-row proforma-fund-header"><div class="proforma-fund-label">Fund Summary</div>';
  for (var y = 0; y < years; y++) html += '<div class="proforma-fund-cell">Year ' + (y + 1) + '</div>';
  html += '</div>';

  var fundRows = [
    { label: 'Gross Production (bbls)', data: fundRollup.totalProduction, fmt: 'number' },
    { label: 'Fund Income', data: fundRollup.totalIncome, fmt: 'currency' },
    { label: 'Fund LOEs', data: fundRollup.totalLOE, fmt: 'currency' },
    { label: 'Net Income', data: fundRollup.netIncome, fmt: 'currency', bold: true },
    { label: 'LP Returns (80%)', data: fundRollup.lpReturns, fmt: 'currency', highlight: true },
    { label: 'GP Rev Share (20%)', data: fundRollup.gpRevShare, fmt: 'currency' },
    { label: 'Annual ROI', data: fundRollup.roi, fmt: 'pct' },
    { label: 'Cumulative Return', data: fundRollup.totalReturn, fmt: 'pct', bold: true }
  ];

  for (var fr = 0; fr < fundRows.length; fr++) {
    var row = fundRows[fr];
    var rowClass = 'proforma-fund-row' + (row.bold ? ' proforma-bold' : '') + (row.highlight ? ' proforma-highlight' : '');
    html += '<div class="' + rowClass + '"><div class="proforma-fund-label">' + row.label + '</div>';
    for (var yy = 0; yy < years; yy++) {
      var val = row.data[yy];
      var display;
      if (row.fmt === 'currency') display = formatCurrency(Math.round(val));
      else if (row.fmt === 'pct') display = (val * 100).toFixed(1) + '%';
      else display = Math.round(val).toLocaleString();
      html += '<div class="proforma-fund-cell">' + display + '</div>';
    }
    html += '</div>';
  }
  html += '</div>';

  // Per-well detail (collapsible)
  html += '<div class="proforma-wells-detail">';
  for (var wi = 0; wi < wellProformas.length; wi++) {
    var wp = wellProformas[wi];
    var w = wp.well;
    var typeLabel = w.driveType === 'water' ? 'Water Drive' : 'Gas Drive';
    var typeBadge = w.driveType === 'water' ? 'proforma-badge-water' : 'proforma-badge-gas';

    html += '<div class="accordion proforma-well-accordion" data-accordion="proforma-' + wi + '">';
    html += '<button class="accordion-header" type="button">';
    html += '<span class="accordion-title">' + w.name + '</span>';
    html += '<span class="' + typeBadge + '">' + typeLabel + '</span>';
    html += '<span class="accordion-badge">' + formatCurrency(Math.round(wp.proratedNOI[0])) + '/yr1</span>';
    html += '<span class="accordion-chevron">&#9662;</span>';
    html += '</button>';
    html += '<div class="accordion-body">';

    // Well info header
    html += '<div class="proforma-well-info">';
    html += '<span>IP: ' + w.ipOilBPD + ' BPD</span>';
    html += '<span>Ownership: ' + (w.ownership * 100).toFixed(3) + '%</span>';
    html += '<span>NRI: ' + (w.nri * 100) + '%</span>';
    html += '<span>Cost: ' + formatCurrency(w.year1Cost) + '</span>';
    if (w.driveType === 'water') {
      html += '<span>Water Cut: ' + (w.waterCut * 100) + '%</span>';
      html += '<span>Fluid: ' + w.fluidBPD + ' BPD</span>';
    }
    html += '</div>';

    // Projection table
    html += '<div class="proforma-table-wrap"><table class="proforma-table"><thead><tr><th></th>';
    for (var y2 = 0; y2 < years; y2++) html += '<th>Yr ' + (y2 + 1) + '</th>';
    html += '</tr></thead><tbody>';

    var wellRows = [
      { label: 'Oil Prod. (bbls)', data: wp.oilProduction, fmt: 'number' },
      { label: 'Prorated Prod.', data: wp.proratedProduction, fmt: 'number' },
      { label: 'NRI Revenue', data: wp.nriRevenue, fmt: 'currency' },
      { label: 'Prorated NRI', data: wp.proratedNRI, fmt: 'currency' }
    ];

    if (w.driveType === 'water') {
      wellRows.push({ label: 'Water Disposal', data: wp.waterDisposal, fmt: 'currency' });
    }
    wellRows.push({ label: 'Other LOE', data: wp.otherLOE, fmt: 'currency' });
    wellRows.push({ label: 'Total LOE', data: wp.totalLOE, fmt: 'currency' });
    wellRows.push({ label: 'Prorated NOI', data: wp.proratedNOI, fmt: 'currency', bold: true });
    wellRows.push({ label: 'Cash-on-Cash', data: wp.cocr, fmt: 'pct' });
    wellRows.push({ label: 'Cumulative ROI', data: wp.cumulativeROI, fmt: 'pct', bold: true });
    wellRows.push({ label: 'Depletion Deduction', data: wp.depletionDeduction, fmt: 'currency' });
    wellRows.push({ label: 'Taxable Income', data: wp.taxableIncome, fmt: 'currency' });

    for (var wr = 0; wr < wellRows.length; wr++) {
      var r = wellRows[wr];
      html += '<tr' + (r.bold ? ' class="proforma-bold"' : '') + '><td>' + r.label + '</td>';
      for (var y3 = 0; y3 < years; y3++) {
        var v = r.data[y3];
        var d;
        if (r.fmt === 'currency') d = formatCurrency(Math.round(v));
        else if (r.fmt === 'pct') d = (v * 100).toFixed(1) + '%';
        else d = Math.round(v).toLocaleString();
        html += '<td>' + d + '</td>';
      }
      html += '</tr>';
    }

    html += '</tbody></table></div>';
    html += '</div></div>';
  }
  html += '</div>';

  container.innerHTML = html;

  // Init accordion behavior for proforma wells
  var proAccordions = container.querySelectorAll('.proforma-well-accordion');
  for (var pa = 0; pa < proAccordions.length; pa++) {
    (function(acc) {
      var header = acc.querySelector('.accordion-header');
      header.addEventListener('click', function() {
        acc.classList.toggle('open');
      });
    })(proAccordions[pa]);
  }
}
