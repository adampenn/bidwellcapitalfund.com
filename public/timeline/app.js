/**
 * Main application controller — wires UI, engine, and rendering together.
 */
(function() {
  'use strict';

  /* ==========================================================
     DOM REFERENCES
     ========================================================== */

  var authScreen = document.getElementById('auth-screen');
  var authInput = document.getElementById('auth-input');
  var authBtn = document.getElementById('auth-btn');
  var authError = document.getElementById('auth-error');
  var appEl = document.getElementById('app');
  var outputEl = document.getElementById('output');

  var inpStart = document.getElementById('inp-start');
  var inpMode = document.getElementById('inp-mode');
  var inpOverlap = document.getElementById('inp-overlap');
  var overlapField = document.getElementById('overlap-field');
  var inpBuffer = document.getElementById('inp-buffer');

  var inpInvestment = document.getElementById('inp-investment');
  var inpIdcPct = document.getElementById('inp-idc-pct');
  var inpOverheadPct = document.getElementById('inp-overhead-pct');
  var inpBonusDepr = document.getElementById('inp-bonus-depr');
  var inpDistLag = document.getElementById('inp-dist-lag');

  var btnGenerate = document.getElementById('btn-generate');
  var btnReset = document.getElementById('btn-reset');
  var btnPDF = document.getElementById('btn-pdf');
  var btnCSV = document.getElementById('btn-csv');
  var btnCopy = document.getElementById('btn-copy');

  var summaryCard = document.getElementById('summary-card');
  var ganttContainer = document.getElementById('gantt-container');
  var ganttLegend = document.getElementById('gantt-legend');
  var tableContainer = document.getElementById('table-container');
  var cashflowCard = document.getElementById('cashflow-card');
  var cashflowContent = document.getElementById('cashflow-content');
  var taxCard = document.getElementById('tax-card');
  var taxContent = document.getElementById('tax-content');
  var proformaOutput = document.getElementById('proforma-output');

  var tooltip = null;
  var generatedData = null;

  /* ==========================================================
     ACCORDION SYSTEM
     ========================================================== */

  function initAccordions() {
    var accordions = document.querySelectorAll('.accordion[data-accordion]');
    for (var i = 0; i < accordions.length; i++) {
      (function(acc) {
        var header = acc.querySelector('.accordion-header');
        if (acc.getAttribute('data-open') === 'true') acc.classList.add('open');
        header.addEventListener('click', function() {
          var willOpen = !acc.classList.contains('open');
          // Auto-close sibling accordions in the same parent (controls section)
          if (willOpen) {
            var parent = acc.parentElement;
            var siblings = parent.querySelectorAll(':scope > .accordion[data-accordion]');
            for (var j = 0; j < siblings.length; j++) {
              if (siblings[j] !== acc) siblings[j].classList.remove('open');
            }
          }
          acc.classList.toggle('open');
        });
      })(accordions[i]);
    }
  }

  /* ==========================================================
     WELL LIST MANAGEMENT
     ========================================================== */

  var wellListBody = document.getElementById('well-list-body');
  var btnAddWell = document.getElementById('btn-add-well');
  var btnSetWells = document.getElementById('btn-set-wells');
  var inpQuickWells = document.getElementById('inp-quick-wells');
  var btnClearWells = document.getElementById('btn-clear-wells');
  var wellCountBadge = document.getElementById('well-count-badge');

  function updateWellCountBadge() {
    var count = wellListBody.querySelectorAll('tr').length;
    if (wellCountBadge) wellCountBadge.textContent = count + ' well' + (count !== 1 ? 's' : '');
  }

  function getWellList() {
    var rows = wellListBody.querySelectorAll('tr');
    var list = [];
    for (var i = 0; i < rows.length; i++) {
      var nameInput = rows[i].querySelector('.well-name-input');
      var rigSelect = rows[i].querySelector('.well-rig-select');
      list.push({ name: nameInput.value.trim() || ('Well ' + (i + 1)), rig: parseInt(rigSelect.value) || 1 });
    }
    return list;
  }

  function addWellRow(name, rig) {
    var idx = wellListBody.querySelectorAll('tr').length + 1;
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + idx + '</td>' +
      '<td><input type="text" class="well-name-input" value="' + escapeAttr(name || ('Well ' + idx)) + '" placeholder="Well ' + idx + '" /></td>' +
      '<td><select class="well-rig-select">' +
        '<option value="1"' + (rig === 1 || !rig ? ' selected' : '') + '>Rig 1</option>' +
        '<option value="2"' + (rig === 2 ? ' selected' : '') + '>Rig 2</option>' +
        '<option value="3"' + (rig === 3 ? ' selected' : '') + '>Rig 3</option>' +
      '</select></td>' +
      '<td><button class="btn-remove-well" title="Remove">&times;</button></td>';
    tr.querySelector('.btn-remove-well').addEventListener('click', function() {
      tr.remove();
      renumberWells();
      updateWellCountBadge();
    });
    wellListBody.appendChild(tr);
    updateWellCountBadge();
  }

  function renumberWells() {
    var rows = wellListBody.querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) {
      rows[i].querySelector('td:first-child').textContent = i + 1;
    }
  }

  function populateDefaultWells(count) {
    wellListBody.innerHTML = '';
    for (var i = 0; i < count; i++) addWellRow('Well ' + (i + 1), 1);
  }

  btnAddWell.addEventListener('click', function() { addWellRow(); });
  btnSetWells.addEventListener('click', function() {
    var count = Math.max(1, Math.min(50, parseInt(inpQuickWells.value) || 10));
    populateDefaultWells(count);
  });
  btnClearWells.addEventListener('click', function() {
    wellListBody.innerHTML = '';
    addWellRow('Well 1', 1);
  });

  /* ==========================================================
     AUTH MODULE
     ========================================================== */

  function handleUnlock() {
    var pwd = authInput.value.trim();
    if (pwd === ACCESS_PASSWORD) {
      try { sessionStorage.setItem('rcr_auth', '1'); } catch(e) {}
      authScreen.style.display = 'none';
      appEl.style.display = 'block';
      doGenerateAndRender();
    } else {
      authError.textContent = 'Incorrect access code. Please try again.';
      authInput.value = '';
      authInput.focus();
    }
  }

  function checkSessionAuth() {
    try {
      if (sessionStorage.getItem('rcr_auth') === '1') {
        authScreen.style.display = 'none';
        appEl.style.display = 'block';
        populateDefaults();
        doGenerateAndRender();
        return true;
      }
    } catch(e) {}
    return false;
  }

  authBtn.addEventListener('click', handleUnlock);
  authInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') handleUnlock(); });

  /* ==========================================================
     POPULATE UI WITH DEFAULTS
     ========================================================== */

  function populateDefaults() {
    inpStart.value = toDateInputValue(new Date());
    populateDefaultWells(10);
    inpMode.value = 'sequential';
    inpOverlap.value = 4;
    inpBuffer.value = 0;
    inpInvestment.value = 5000000;
    inpIdcPct.value = 80;
    inpOverheadPct.value = 5;
    inpBonusDepr.value = 100;
    inpDistLag.value = 2;
    overlapField.style.display = 'none';
    setAssumptionsUI(DEFAULT_ASSUMPTIONS);
    updatePresetButtons('base');
  }

  function setAssumptionsUI(a) {
    var inputs = document.querySelectorAll('.assumption');
    for (var i = 0; i < inputs.length; i++) {
      var key = inputs[i].getAttribute('data-key');
      if (a[key] !== undefined) inputs[i].value = a[key];
    }
  }

  function getAssumptionsFromUI() {
    var a = {};
    var inputs = document.querySelectorAll('.assumption');
    for (var i = 0; i < inputs.length; i++) {
      var key = inputs[i].getAttribute('data-key');
      a[key] = Math.max(0, parseInt(inputs[i].value) || 0);
    }
    return a;
  }

  function updatePresetButtons(activeScenario) {
    var btns = document.querySelectorAll('.btn-preset');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-scenario') === activeScenario);
    }
  }

  function getDisplayOpts() {
    return {
      milestones: document.getElementById('opt-milestones').checked,
      labels: document.getElementById('opt-labels').checked,
      compact: document.getElementById('opt-compact').checked,
      weekends: document.getElementById('opt-weekends').checked,
      today: document.getElementById('opt-today').checked,
      summaryView: document.getElementById('opt-summary-view').checked,
      consolidated: document.getElementById('opt-consolidated').checked
    };
  }

  /* ==========================================================
     TOOLTIPS
     ========================================================== */

  function initTooltips() {
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'gantt-tooltip';
      document.body.appendChild(tooltip);
    }
    var bars = ganttContainer.querySelectorAll('.gantt-bar');
    for (var i = 0; i < bars.length; i++) {
      bars[i].addEventListener('mouseenter', function(e) {
        var el = e.currentTarget;
        tooltip.innerHTML =
          '<strong>' + el.getAttribute('data-tt-name') + '</strong>' +
          '<div class="tt-well">' + el.getAttribute('data-tt-well') + '</div>' +
          '<div class="tt-dates">' + el.getAttribute('data-tt-start') + ' — ' + el.getAttribute('data-tt-end') + '</div>' +
          '<div>' + el.getAttribute('data-tt-dur') + '</div>';
        tooltip.classList.add('visible');
      });
      bars[i].addEventListener('mousemove', function(e) {
        var x = e.clientX + 14;
        var y = e.clientY + 14;
        if (x + 260 > window.innerWidth) x = e.clientX - 270;
        if (y + 100 > window.innerHeight) y = e.clientY - 100;
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
      });
      bars[i].addEventListener('mouseleave', function() { tooltip.classList.remove('visible'); });
    }
  }

  /* ==========================================================
     MAIN: GENERATE AND RENDER
     ========================================================== */

  function doGenerateAndRender() {
    var startDate = parseDateInput(inpStart.value);
    var wellDefs = getWellList();
    var a = getAssumptionsFromUI();

    generatedData = generateSchedule({
      startDate: startDate,
      wellDefs: wellDefs,
      mode: inpMode.value,
      overlapOffset: Math.max(1, parseInt(inpOverlap.value) || 4),
      globalBuffer: Math.max(0, parseInt(inpBuffer.value) || 0),
      assumptions: a,
      weatherEnabled: document.getElementById('opt-weather').checked,
      weatherRisk: document.getElementById('inp-weather-risk').value,
      distLag: Math.max(0, parseInt(inpDistLag.value) || 2),
      totalInvestment: Math.max(0, parseFloat(inpInvestment.value) || 0),
      idcPct: Math.max(0, Math.min(100, parseFloat(inpIdcPct.value) || 80)),
      overheadPct: Math.max(0, Math.min(100, parseFloat(inpOverheadPct.value) || 5)),
      bonusDeprPct: Math.max(0, Math.min(100, parseFloat(inpBonusDepr.value) || 100))
    });

    if (!generatedData) return;

    outputEl.style.display = 'block';
    renderSummary(generatedData, summaryCard);
    renderCashflow(generatedData, cashflowContent, cashflowCard);
    renderTax(generatedData, taxContent, taxCard);
    renderLegend(ganttLegend);
    renderGantt(generatedData, ganttContainer, false, getDisplayOpts());
    renderTable(generatedData, tableContainer);
    initTooltips();

    // Run proforma if wells have been added
    runProforma();

    // Update weather info
    var weatherInfo = document.getElementById('weather-info');
    if (generatedData.weatherEnabled) {
      weatherInfo.innerHTML = 'Weather delays: <strong>' + generatedData.totalWeatherDays + ' days</strong> total (' + generatedData.weatherRisk + ' profile).';
    } else {
      weatherInfo.textContent = 'Weather delays disabled.';
    }

    // Update investment badge
    var invBadge = document.getElementById('investment-badge');
    if (invBadge) invBadge.textContent = formatCurrency(Math.round(parseFloat(inpInvestment.value) || 0));

    outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    saveConfigToSession();
  }

  /* ==========================================================
     EXPORTS
     ========================================================== */

  function exportPDF() {
    if (!generatedData) return;
    var d = generatedData;
    var overlay = document.getElementById('pdf-overlay');
    var pdfSummary = document.getElementById('pdf-summary');
    var pdfCashflow = document.getElementById('pdf-cashflow');
    var pdfTax = document.getElementById('pdf-tax');
    var pdfGantt = document.getElementById('pdf-gantt');
    var pdfTable = document.getElementById('pdf-table');
    document.getElementById('pdf-date').textContent = formatDate(new Date());

    var modeLabel = d.mode === 'overlap' ? 'Overlapped (' + d.overlapOffset + 'd offset)' : 'Sequential';
    pdfSummary.innerHTML =
      '<div class="summary-card" style="margin-bottom:1.5rem;">' +
      '<div class="summary-item"><div class="summary-item-label">Project Start</div><div class="summary-item-value">' + formatDate(d.startDate) + '</div></div>' +
      '<div class="summary-item"><div class="summary-item-label">Wells</div><div class="summary-item-value">' + d.numWells + '</div></div>' +
      '<div class="summary-item"><div class="summary-item-label">Drilling Mode</div><div class="summary-item-value">' + modeLabel + '</div></div>' +
      '<div class="summary-item"><div class="summary-item-label">Est. First Production</div><div class="summary-item-value">' + formatDate(d.firstProductionDate) + '</div></div>' +
      '<div class="summary-item"><div class="summary-item-label">Final Stabilized</div><div class="summary-item-value">' + formatDate(d.finalStabilizedDate) + '</div></div>' +
      '<div class="summary-item"><div class="summary-item-label">Total Duration</div><div class="summary-item-value">' + d.totalDays + ' days</div></div></div>';

    if (d.firstProductionMonth) {
      pdfCashflow.innerHTML = '<div class="info-card" style="margin-bottom:1rem;"><h3 class="info-card-title" style="font-size:0.95rem;">Cashflow &amp; Distribution Timeline</h3><div class="info-card-body" id="pdf-cashflow-inner"></div></div>';
      renderCashflow(d, document.getElementById('pdf-cashflow-inner'));
    } else { pdfCashflow.innerHTML = ''; }

    if (d.totalInvestment > 0) {
      pdfTax.innerHTML = '<div class="info-card" style="margin-bottom:1rem;"><h3 class="info-card-title" style="font-size:0.95rem;">Tax Deduction Summary</h3><div class="info-card-body" id="pdf-tax-inner"></div></div>';
      renderTax(d, document.getElementById('pdf-tax-inner'));
    } else { pdfTax.innerHTML = ''; }

    renderGantt(d, pdfGantt, true, getDisplayOpts());
    renderTable(d, pdfTable);

    overlay.style.display = 'block';
    appEl.style.display = 'none';
    setTimeout(function() {
      window.print();
      overlay.style.display = 'none';
      appEl.style.display = 'block';
    }, 300);
  }

  function exportCSV() {
    if (!generatedData) return;
    var d = generatedData;
    var lines = ['Well,Phase,Start Date,End Date,Duration (days)'];
    for (var pp = 0; pp < d.projectPhases.length; pp++) {
      var p = d.projectPhases[pp];
      lines.push('Project,"' + p.name + '",' + formatDate(p.start) + ',' + formatDate(p.end) + ',' + p.duration);
    }
    for (var w = 0; w < d.wells.length; w++) {
      for (var ph = 0; ph < d.wells[w].length; ph++) {
        var phase = d.wells[w][ph];
        lines.push('"' + d.wellNames[w] + '","' + phase.name + '",' + formatDate(phase.start) + ',' + formatDate(phase.end) + ',' + phase.duration);
      }
    }
    var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'rcr-timeline-' + toDateInputValue(new Date()) + '.csv';
    a.click(); URL.revokeObjectURL(url);
  }

  function copySummary() {
    if (!generatedData) return;
    var d = generatedData;
    var modeLabel = d.mode === 'overlap' ? 'Overlapped (' + d.overlapOffset + '-day offset)' : 'Sequential';
    var text = 'OKLAHOMA OIL DEVELOPMENT TIMELINE\nRush Creek Resources\n========================================\n\n' +
      'Project Start Date: ' + formatDate(d.startDate) + '\nNumber of Wells: ' + d.numWells + '\nDrilling Mode: ' + modeLabel + '\n\n' +
      'Estimated First Production: ' + formatDate(d.firstProductionDate) + '\nFinal Stabilized Production: ' + formatDate(d.finalStabilizedDate) + '\nTotal Project Duration: ' + d.totalDays + ' days\n\n' +
      'PER-WELL SUMMARY\n----------------------------------------\n';
    for (var w = 0; w < d.wells.length; w++) {
      var phases = d.wells[w];
      if (phases.length > 0) text += d.wellNames[w] + ': ' + formatDate(phases[0].start) + ' — ' + formatDate(phases[phases.length - 1].end) + '\n';
    }
    if (d.firstDistDate) {
      text += '\nCASHFLOW TIMELINE\n----------------------------------------\n' +
        'First Distribution Check: ' + formatDate(d.firstDistDate) + ' (' + d.distLag + '-month lag)\n';
    }
    text += '\n--- Bidwell Capital — Confidential ---';
    navigator.clipboard.writeText(text).then(function() {
      btnCopy.textContent = 'Copied!';
      setTimeout(function() { btnCopy.textContent = 'Copy Summary'; }, 2000);
    });
  }

  /* ==========================================================
     CONFIG SAVE / LOAD / SESSION CACHE
     ========================================================== */

  var btnSaveConfig = document.getElementById('btn-save-config');
  var btnLoadConfig = document.getElementById('btn-load-config');
  var configFileInput = document.getElementById('config-file-input');
  var CONFIG_SESSION_KEY = 'rcr_timeline_config';

  function gatherConfig() {
    return {
      version: 1, projectStart: inpStart.value, drillingMode: inpMode.value,
      overlapOffset: inpOverlap.value, globalBuffer: inpBuffer.value,
      investment: inpInvestment.value, idcPct: inpIdcPct.value,
      overheadPct: inpOverheadPct.value, bonusDepr: inpBonusDepr.value,
      distLag: inpDistLag.value, assumptions: getAssumptionsFromUI(),
      wells: getWellList(),
      display: {
        milestones: document.getElementById('opt-milestones').checked,
        labels: document.getElementById('opt-labels').checked,
        compact: document.getElementById('opt-compact').checked,
        weekends: document.getElementById('opt-weekends').checked,
        today: document.getElementById('opt-today').checked,
        summaryView: document.getElementById('opt-summary-view').checked,
        consolidated: document.getElementById('opt-consolidated').checked,
        weather: document.getElementById('opt-weather').checked,
        weatherRisk: document.getElementById('inp-weather-risk').value
      }
    };
  }

  function applyConfig(cfg) {
    if (!cfg || cfg.version === undefined) return false;
    try {
      if (cfg.projectStart) inpStart.value = cfg.projectStart;
      if (cfg.drillingMode) { inpMode.value = cfg.drillingMode; overlapField.style.display = cfg.drillingMode === 'overlap' ? 'block' : 'none'; }
      if (cfg.overlapOffset !== undefined) inpOverlap.value = cfg.overlapOffset;
      if (cfg.globalBuffer !== undefined) inpBuffer.value = cfg.globalBuffer;
      if (cfg.investment !== undefined) inpInvestment.value = cfg.investment;
      if (cfg.idcPct !== undefined) inpIdcPct.value = cfg.idcPct;
      if (cfg.overheadPct !== undefined) inpOverheadPct.value = cfg.overheadPct;
      if (cfg.bonusDepr !== undefined) inpBonusDepr.value = cfg.bonusDepr;
      if (cfg.distLag !== undefined) inpDistLag.value = cfg.distLag;
      if (cfg.assumptions) setAssumptionsUI(cfg.assumptions);
      if (cfg.wells && cfg.wells.length > 0) {
        wellListBody.innerHTML = '';
        for (var i = 0; i < cfg.wells.length; i++) addWellRow(cfg.wells[i].name, cfg.wells[i].rig);
      }
      if (cfg.display) {
        var d = cfg.display;
        if (d.milestones !== undefined) document.getElementById('opt-milestones').checked = d.milestones;
        if (d.labels !== undefined) document.getElementById('opt-labels').checked = d.labels;
        if (d.compact !== undefined) document.getElementById('opt-compact').checked = d.compact;
        if (d.weekends !== undefined) document.getElementById('opt-weekends').checked = d.weekends;
        if (d.today !== undefined) document.getElementById('opt-today').checked = d.today;
        if (d.summaryView !== undefined) document.getElementById('opt-summary-view').checked = d.summaryView;
        if (d.consolidated !== undefined) document.getElementById('opt-consolidated').checked = d.consolidated;
        if (d.weather !== undefined) document.getElementById('opt-weather').checked = d.weather;
        if (d.weatherRisk) document.getElementById('inp-weather-risk').value = d.weatherRisk;
      }
      return true;
    } catch (e) { return false; }
  }

  function saveConfigToSession() {
    try { sessionStorage.setItem(CONFIG_SESSION_KEY, JSON.stringify(gatherConfig())); } catch (e) {}
  }

  function loadConfigFromSession() {
    try {
      var stored = sessionStorage.getItem(CONFIG_SESSION_KEY);
      if (stored) return applyConfig(JSON.parse(stored));
    } catch (e) {}
    return false;
  }

  btnSaveConfig.addEventListener('click', function() {
    var cfg = gatherConfig();
    var json = JSON.stringify(cfg, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'rcr-config-' + cfg.wells.length + 'wells-' + toDateInputValue(new Date()) + '.json';
    a.click(); URL.revokeObjectURL(url);
  });

  btnLoadConfig.addEventListener('click', function() { configFileInput.click(); });
  configFileInput.addEventListener('change', function() {
    if (configFileInput.files.length > 0) {
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          if (applyConfig(JSON.parse(e.target.result))) { saveConfigToSession(); doGenerateAndRender(); }
          else alert('Invalid config file format.');
        } catch (err) { alert('Could not parse config file: ' + err.message); }
      };
      reader.readAsText(configFileInput.files[0]);
      configFileInput.value = '';
    }
  });

  /* ==========================================================
     PROFORMA WELL BUILDER
     ========================================================== */

  var pfWellList = [];  // array of well config objects
  var pfWellListEl = document.getElementById('pf-well-list');
  var pfRunBar = document.getElementById('pf-run-bar');
  var pfCountBadge = document.getElementById('proforma-well-count-badge');

  // Input refs
  var pfNewName = document.getElementById('pf-new-name');
  var pfNewTemplate = document.getElementById('pf-new-template');
  var pfNewDrive = document.getElementById('pf-new-drive');
  var pfNewCost = document.getElementById('pf-new-cost');
  var pfNewWI = document.getElementById('pf-new-wi');
  var pfNewNRI = document.getElementById('pf-new-nri');
  var pfNewIP = document.getElementById('pf-new-ip');
  var pfNewLOE = document.getElementById('pf-new-loe');
  var pfWaterFields = document.getElementById('pf-water-fields');
  var pfNewFluid = document.getElementById('pf-new-fluid');
  var pfNewWatercut = document.getElementById('pf-new-watercut');

  var pfOilPrice = document.getElementById('pf-oil-price');
  var pfUptime = document.getElementById('pf-uptime');
  var pfPriceGrowth = document.getElementById('pf-price-growth');
  var pfCapitalRaise = document.getElementById('pf-capital-raise');
  var pfRevShare = document.getElementById('pf-rev-share');

  // Show/hide water fields based on drive type
  pfNewDrive.addEventListener('change', function() {
    pfWaterFields.style.display = pfNewDrive.value === 'water' ? 'grid' : 'none';
  });

  // Template selection auto-fills fields
  pfNewTemplate.addEventListener('change', function() {
    var key = pfNewTemplate.value;
    if (!key) return;
    var tpl = WELL_TYPE_TEMPLATES[key];
    if (!tpl) return;
    pfNewDrive.value = tpl.driveType;
    pfNewIP.value = tpl.ipOilBPD;
    pfNewNRI.value = (tpl.nri * 100);
    pfNewLOE.value = tpl.loeMonthlyCost;
    pfWaterFields.style.display = tpl.driveType === 'water' ? 'grid' : 'none';
    if (tpl.driveType === 'water') {
      pfNewFluid.value = tpl.fluidBPD || 2000;
      pfNewWatercut.value = (tpl.waterCut || 0.96) * 100;
    }
  });

  function buildWellFromInputs() {
    var driveType = pfNewDrive.value;
    var isWater = driveType === 'water';
    var templateKey = pfNewTemplate.value;
    var tpl = templateKey ? WELL_TYPE_TEMPLATES[templateKey] : null;

    var well = {
      name: pfNewName.value.trim() || ('Well ' + (pfWellList.length + 1)),
      driveType: driveType,
      year1Cost: Math.max(0, parseFloat(pfNewCost.value) || 0),
      ownership: Math.max(0, Math.min(1, (parseFloat(pfNewWI.value) || 0) / 100)),
      nri: Math.max(0, Math.min(1, (parseFloat(pfNewNRI.value) || 75) / 100)),
      ipOilBPD: Math.max(0, parseFloat(pfNewIP.value) || 0),
      loeMonthlyCost: Math.max(0, parseFloat(pfNewLOE.value) || 0),
      depletionAllowance: isWater ? 0.15 : 0.30,
      declineRates: tpl ? tpl.declineRates : (isWater
        ? [null, 0.15, 0.10, 0.07, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05]
        : [null, 0.50, 0.05, 0.05, 0.04, 0.04, 0.03, 0.03, 0.03, 0.03])
    };

    if (isWater) {
      well.fluidBPD = Math.max(0, parseFloat(pfNewFluid.value) || 2000);
      well.waterCut = Math.max(0, Math.min(1, (parseFloat(pfNewWatercut.value) || 96) / 100));
      well.waterDisposalPrices = tpl && tpl.waterDisposalPrices
        ? tpl.waterDisposalPrices
        : [0.50, 0.50, 0.50, 0.75, 0.75, 0.75, 1.00, 1.00, 1.00, 1.00];
    }

    return well;
  }

  function addProformaWell(well) {
    pfWellList.push(well);
    renderProformaWellList();
  }

  function removeProformaWell(idx) {
    pfWellList.splice(idx, 1);
    renderProformaWellList();
  }

  function renderProformaWellList() {
    var count = pfWellList.length;
    pfCountBadge.textContent = count + ' well' + (count !== 1 ? 's' : '');
    pfRunBar.style.display = count > 0 ? 'flex' : 'none';

    if (count === 0) {
      pfWellListEl.innerHTML = '<div style="font-size:0.75rem;color:#9b9ba8;padding:0.5rem 0;">No wells added yet. Use the form above or load the Oil Fund 6 preset.</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < pfWellList.length; i++) {
      var w = pfWellList[i];
      var badgeClass = w.driveType === 'water' ? 'water' : 'gas';
      var badgeLabel = w.driveType === 'water' ? 'Water' : 'Gas';
      var details = 'IP: ' + w.ipOilBPD + ' BPD · WI: ' + (w.ownership * 100).toFixed(3) + '% · Cost: ' + formatCurrency(w.year1Cost);
      if (w.driveType === 'water') {
        details += ' · Fluid: ' + w.fluidBPD + ' BPD · WC: ' + (w.waterCut * 100).toFixed(0) + '%';
      }
      html += '<div class="pf-well-chip" data-pf-idx="' + i + '">' +
        '<span class="pf-well-chip-badge ' + badgeClass + '">' + badgeLabel + '</span>' +
        '<span class="pf-well-chip-name">' + escapeAttr(w.name) + '</span>' +
        '<span class="pf-well-chip-detail">' + details + '</span>' +
        '<button class="pf-well-chip-remove" data-pf-remove="' + i + '" title="Remove">&times;</button>' +
        '</div>';
    }
    pfWellListEl.innerHTML = html;

    // Attach remove listeners
    var removeBtns = pfWellListEl.querySelectorAll('.pf-well-chip-remove');
    for (var r = 0; r < removeBtns.length; r++) {
      removeBtns[r].addEventListener('click', function() {
        removeProformaWell(parseInt(this.getAttribute('data-pf-remove')));
      });
    }
  }

  function getProformaGlobals() {
    return {
      oilPrice: Math.max(0, parseFloat(pfOilPrice.value) || 60),
      wellUptime: Math.max(0, Math.min(1, (parseFloat(pfUptime.value) || 90) / 100)),
      priceGrowth: (parseFloat(pfPriceGrowth.value) || 0) / 100,
      capitalRaise: Math.max(0, parseFloat(pfCapitalRaise.value) || 0),
      revShare: Math.max(0, Math.min(1, (parseFloat(pfRevShare.value) || 20) / 100))
    };
  }

  function runProforma() {
    if (pfWellList.length === 0) {
      proformaOutput.innerHTML = '';
      proformaOutput.style.display = 'none';
      return;
    }
    var globals = getProformaGlobals();
    var wellProformas = [];
    for (var i = 0; i < pfWellList.length; i++) {
      wellProformas.push(calculateWellProforma(pfWellList[i], globals));
    }
    var fundRollup = calculateFundProforma(wellProformas, globals);
    renderProformaOutput(wellProformas, fundRollup, globals, proformaOutput);
  }

  // Add well button
  document.getElementById('btn-pf-add-well').addEventListener('click', function() {
    var well = buildWellFromInputs();
    addProformaWell(well);
    // Clear name for next entry, keep other fields
    pfNewName.value = '';
    pfNewName.focus();
  });

  // Load Oil Fund 6 preset
  document.getElementById('btn-pf-load-fund6').addEventListener('click', function() {
    pfWellList = [];
    for (var i = 0; i < PROFORMA_WELLS.length; i++) {
      pfWellList.push(Object.assign({}, PROFORMA_WELLS[i]));
    }
    renderProformaWellList();
  });

  // Clear all proforma wells
  document.getElementById('btn-pf-clear-wells').addEventListener('click', function() {
    pfWellList = [];
    renderProformaWellList();
    proformaOutput.innerHTML = '';
    proformaOutput.style.display = 'none';
  });

  // Run proforma button
  document.getElementById('btn-pf-run').addEventListener('click', function() {
    runProforma();
    // Scroll to output
    if (proformaOutput.offsetParent !== null) {
      proformaOutput.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // Initialize empty list display
  renderProformaWellList();

  /* ==========================================================
     EVENT LISTENERS
     ========================================================== */

  btnGenerate.addEventListener('click', doGenerateAndRender);
  btnReset.addEventListener('click', function() { populateDefaults(); outputEl.style.display = 'none'; });
  btnPDF.addEventListener('click', exportPDF);
  btnCSV.addEventListener('click', exportCSV);
  btnCopy.addEventListener('click', copySummary);
  inpMode.addEventListener('change', function() {
    overlapField.style.display = inpMode.value === 'overlap' ? 'block' : 'none';
  });

  var presetBtns = document.querySelectorAll('.btn-preset');
  for (var i = 0; i < presetBtns.length; i++) {
    presetBtns[i].addEventListener('click', function() {
      var scenario = this.getAttribute('data-scenario');
      var preset = SCENARIO_PRESETS[scenario];
      if (preset) { setAssumptionsUI(preset); updatePresetButtons(scenario); }
    });
  }

  /* ==========================================================
     INITIALIZATION
     ========================================================== */

  initAccordions();
  if (!loadConfigFromSession()) populateDefaults();
  if (!checkSessionAuth()) authInput.focus();

})();
