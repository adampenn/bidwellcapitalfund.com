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
     WELL LIST MANAGEMENT (unified: timeline + proforma)
     ========================================================== */

  var wellListBody = document.getElementById('well-list-body');
  var btnAddWell = document.getElementById('btn-add-well');
  var btnSetWells = document.getElementById('btn-set-wells');
  var inpQuickWells = document.getElementById('inp-quick-wells');
  var btnClearWells = document.getElementById('btn-clear-wells');
  var wellCountBadge = document.getElementById('well-count-badge');
  var btnLoadFund6 = document.getElementById('btn-pf-load-fund6');

  function updateWellCountBadge() {
    var count = wellListBody.querySelectorAll('tr.well-main-row').length;
    if (wellCountBadge) wellCountBadge.textContent = count + ' well' + (count !== 1 ? 's' : '');
  }

  /**
   * Returns the well list for the timeline engine (name + rig).
   */
  function getWellList() {
    var rows = wellListBody.querySelectorAll('tr.well-main-row');
    var list = [];
    for (var i = 0; i < rows.length; i++) {
      list.push({
        name: rows[i].querySelector('.well-name-input').value.trim() || ('Well ' + (i + 1)),
        rig: parseInt(rows[i].querySelector('.well-rig-select').value) || 1
      });
    }
    return list;
  }

  /**
   * Returns the well list with full proforma data for each well.
   */
  function getWellListWithProforma() {
    var rows = wellListBody.querySelectorAll('tr.well-main-row');
    var list = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var detailRow = row.nextElementSibling;
      var driveType = row.querySelector('.well-type-select').value;
      var isWater = driveType === 'water';

      // Read detail fields (or use defaults)
      var ip, nri, loe, fluidBPD, waterCut, templateKey;
      if (detailRow && detailRow.classList.contains('well-detail-row')) {
        ip = parseFloat(detailRow.querySelector('.wd-ip').value) || (isWater ? 80 : 30);
        nri = (parseFloat(detailRow.querySelector('.wd-nri').value) || 75) / 100;
        loe = parseFloat(detailRow.querySelector('.wd-loe').value) || (isWater ? 3000 : 2000);
        templateKey = detailRow.querySelector('.wd-template') ? detailRow.querySelector('.wd-template').value : '';
        if (isWater) {
          var fluidEl = detailRow.querySelector('.wd-fluid');
          var wcEl = detailRow.querySelector('.wd-watercut');
          fluidBPD = fluidEl ? parseFloat(fluidEl.value) || 2000 : 2000;
          waterCut = wcEl ? (parseFloat(wcEl.value) || 96) / 100 : 0.96;
        }
      } else {
        ip = isWater ? 80 : 30;
        nri = 0.75;
        loe = isWater ? 3000 : 2000;
        templateKey = '';
        fluidBPD = 2000;
        waterCut = 0.96;
      }

      var tpl = templateKey ? WELL_TYPE_TEMPLATES[templateKey] : null;

      var well = {
        name: row.querySelector('.well-name-input').value.trim() || ('Well ' + (i + 1)),
        rig: parseInt(row.querySelector('.well-rig-select').value) || 1,
        driveType: driveType,
        year1Cost: Math.max(0, parseFloat(row.querySelector('.well-cost-input').value) || 0),
        ownership: Math.max(0, Math.min(1, (parseFloat(row.querySelector('.well-wi-input').value) || 0) / 100)),
        nri: nri,
        ipOilBPD: ip,
        loeMonthlyCost: loe,
        depletionAllowance: isWater ? 0.15 : 0.30,
        declineRates: tpl ? tpl.declineRates : (isWater
          ? [null, 0.15, 0.10, 0.07, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05]
          : [null, 0.50, 0.05, 0.05, 0.04, 0.04, 0.03, 0.03, 0.03, 0.03])
      };

      if (isWater) {
        well.fluidBPD = fluidBPD;
        well.waterCut = waterCut;
        well.waterDisposalPrices = tpl && tpl.waterDisposalPrices
          ? tpl.waterDisposalPrices
          : [0.50, 0.50, 0.50, 0.75, 0.75, 0.75, 1.00, 1.00, 1.00, 1.00];
      }

      list.push(well);
    }
    return list;
  }

  /**
   * Add a well row with optional proforma data.
   * opts: { name, rig, driveType, cost, wi, ip, nri, loe, fluidBPD, waterCut, templateKey }
   */
  function addWellRow(opts) {
    opts = opts || {};
    var idx = wellListBody.querySelectorAll('tr.well-main-row').length + 1;
    var name = opts.name || ('Well ' + idx);
    var rig = opts.rig || 1;
    var driveType = opts.driveType || 'gas';
    var cost = opts.cost !== undefined ? opts.cost : '';
    var wi = opts.wi !== undefined ? opts.wi : '';
    var isWater = driveType === 'water';

    // Main row
    var tr = document.createElement('tr');
    tr.className = 'well-main-row';
    tr.innerHTML =
      '<td>' + idx + '</td>' +
      '<td><input type="text" class="well-name-input" value="' + escapeAttr(name) + '" placeholder="Well ' + idx + '" /></td>' +
      '<td><select class="well-rig-select">' +
        '<option value="1"' + (rig === 1 ? ' selected' : '') + '>Rig 1</option>' +
        '<option value="2"' + (rig === 2 ? ' selected' : '') + '>Rig 2</option>' +
        '<option value="3"' + (rig === 3 ? ' selected' : '') + '>Rig 3</option>' +
      '</select></td>' +
      '<td><select class="well-type-select">' +
        '<option value="gas"' + (driveType === 'gas' ? ' selected' : '') + '>Gas</option>' +
        '<option value="water"' + (driveType === 'water' ? ' selected' : '') + '>Water</option>' +
      '</select></td>' +
      '<td><input type="number" class="well-cost-input" value="' + cost + '" placeholder="—" min="0" step="1000" /></td>' +
      '<td><input type="number" class="well-wi-input" value="' + wi + '" placeholder="—" min="0" max="100" step="0.001" /></td>' +
      '<td><button class="btn-expand-well" title="Details">&#9662;</button></td>' +
      '<td><button class="btn-remove-well" title="Remove">&times;</button></td>';

    // Detail row (hidden by default)
    var detailTr = document.createElement('tr');
    detailTr.className = 'well-detail-row';
    detailTr.style.display = 'none';
    var ip = opts.ip !== undefined ? opts.ip : (isWater ? 80 : 30);
    var nri = opts.nri !== undefined ? opts.nri : 75;
    var loe = opts.loe !== undefined ? opts.loe : (isWater ? 3000 : 2000);
    var fluidBPD = opts.fluidBPD !== undefined ? opts.fluidBPD : 2000;
    var waterCut = opts.waterCut !== undefined ? opts.waterCut : 96;
    var tplKey = opts.templateKey || '';

    detailTr.innerHTML = '<td colspan="8"><div class="well-detail-inner">' +
      '<div class="well-detail-template"><label>Template</label><select class="wd-template">' +
        '<option value="">— Custom —</option>' +
        '<option value="gas-standard"' + (tplKey === 'gas-standard' ? ' selected' : '') + '>Gas — Standard (30 BPD)</option>' +
        '<option value="gas-high"' + (tplKey === 'gas-high' ? ' selected' : '') + '>Gas — High IP (60 BPD)</option>' +
        '<option value="water-amarada"' + (tplKey === 'water-amarada' ? ' selected' : '') + '>Water — High Volume</option>' +
        '<option value="water-shallow"' + (tplKey === 'water-shallow' ? ' selected' : '') + '>Water — Shallow</option>' +
      '</select></div>' +
      '<div><label>Oil IP (BPD)</label><input type="number" class="wd-ip" value="' + ip + '" min="0" step="1" /></div>' +
      '<div><label>NRI (%)</label><input type="number" class="wd-nri" value="' + nri + '" min="0" max="100" step="0.1" /></div>' +
      '<div><label>Monthly LOE ($)</label><input type="number" class="wd-loe" value="' + loe + '" min="0" step="100" /></div>' +
      '<div class="well-water-fields' + (isWater ? ' visible' : '') + '">' +
        '<label>Fluid Rate (BPD)</label><input type="number" class="wd-fluid" value="' + fluidBPD + '" min="0" step="10" /></div>' +
      '<div class="well-water-fields' + (isWater ? ' visible' : '') + '">' +
        '<label>Water Cut (%)</label><input type="number" class="wd-watercut" value="' + waterCut + '" min="0" max="100" step="0.5" /></div>' +
      '</div></td>';

    wellListBody.appendChild(tr);
    wellListBody.appendChild(detailTr);

    // Expand/collapse detail
    var expandBtn = tr.querySelector('.btn-expand-well');
    expandBtn.addEventListener('click', function() {
      var isOpen = detailTr.style.display !== 'none';
      detailTr.style.display = isOpen ? 'none' : 'table-row';
      expandBtn.classList.toggle('expanded', !isOpen);
    });

    // Remove well (both rows)
    tr.querySelector('.btn-remove-well').addEventListener('click', function() {
      detailTr.remove();
      tr.remove();
      renumberWells();
      updateWellCountBadge();
    });

    // When type changes, show/hide water fields in detail row
    var typeSelect = tr.querySelector('.well-type-select');
    typeSelect.addEventListener('change', function() {
      var wf = detailTr.querySelectorAll('.well-water-fields');
      for (var f = 0; f < wf.length; f++) {
        wf[f].classList.toggle('visible', typeSelect.value === 'water');
      }
      // Update defaults if fields are empty
      var ipInput = detailTr.querySelector('.wd-ip');
      var loeInput = detailTr.querySelector('.wd-loe');
      if (typeSelect.value === 'water') {
        if (!ipInput.value || ipInput.value === '30') ipInput.value = 80;
        if (!loeInput.value || loeInput.value === '2000') loeInput.value = 3000;
      } else {
        if (!ipInput.value || ipInput.value === '80') ipInput.value = 30;
        if (!loeInput.value || loeInput.value === '3000') loeInput.value = 2000;
      }
    });

    // Template changes update detail fields
    var tplSelect = detailTr.querySelector('.wd-template');
    tplSelect.addEventListener('change', function() {
      var key = tplSelect.value;
      if (!key) return;
      var t = WELL_TYPE_TEMPLATES[key];
      if (!t) return;
      typeSelect.value = t.driveType;
      typeSelect.dispatchEvent(new Event('change'));
      detailTr.querySelector('.wd-ip').value = t.ipOilBPD;
      detailTr.querySelector('.wd-nri').value = (t.nri * 100);
      detailTr.querySelector('.wd-loe').value = t.loeMonthlyCost;
      if (t.driveType === 'water') {
        var fluidInput = detailTr.querySelector('.wd-fluid');
        var wcInput = detailTr.querySelector('.wd-watercut');
        if (fluidInput) fluidInput.value = t.fluidBPD || 2000;
        if (wcInput) wcInput.value = (t.waterCut || 0.96) * 100;
      }
    });

    updateWellCountBadge();
  }

  function renumberWells() {
    var rows = wellListBody.querySelectorAll('tr.well-main-row');
    for (var i = 0; i < rows.length; i++) {
      rows[i].querySelector('td:first-child').textContent = i + 1;
    }
  }

  function populateDefaultWells(count) {
    wellListBody.innerHTML = '';
    for (var i = 0; i < count; i++) addWellRow({ name: 'Well ' + (i + 1), rig: 1 });
  }

  /**
   * Load Oil Fund 6 wells with full proforma data.
   */
  function loadFund6Wells() {
    wellListBody.innerHTML = '';
    for (var i = 0; i < PROFORMA_WELLS.length; i++) {
      var pw = PROFORMA_WELLS[i];
      addWellRow({
        name: pw.name,
        rig: 1,
        driveType: pw.driveType,
        cost: pw.year1Cost,
        wi: (pw.ownership * 100),
        ip: pw.ipOilBPD,
        nri: (pw.nri * 100),
        loe: pw.loeMonthlyCost,
        fluidBPD: pw.fluidBPD || 2000,
        waterCut: pw.waterCut ? (pw.waterCut * 100) : 96
      });
    }
  }

  btnAddWell.addEventListener('click', function() { addWellRow(); });
  btnSetWells.addEventListener('click', function() {
    var count = Math.max(1, Math.min(50, parseInt(inpQuickWells.value) || 10));
    populateDefaultWells(count);
  });
  btnClearWells.addEventListener('click', function() {
    wellListBody.innerHTML = '';
    addWellRow({ name: 'Well 1', rig: 1 });
  });
  btnLoadFund6.addEventListener('click', loadFund6Wells);

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
      wells: getWellListWithProforma(),
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
        for (var i = 0; i < cfg.wells.length; i++) {
          var cw = cfg.wells[i];
          addWellRow({
            name: cw.name, rig: cw.rig,
            driveType: cw.driveType, cost: cw.year1Cost,
            wi: cw.ownership ? (cw.ownership * 100) : undefined,
            ip: cw.ipOilBPD, nri: cw.nri ? (cw.nri * 100) : undefined,
            loe: cw.loeMonthlyCost,
            fluidBPD: cw.fluidBPD, waterCut: cw.waterCut ? (cw.waterCut * 100) : undefined
          });
        }
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
     PROFORMA (reads from unified well list)
     ========================================================== */

  var pfOilPrice = document.getElementById('pf-oil-price');
  var pfUptime = document.getElementById('pf-uptime');
  var pfPriceGrowth = document.getElementById('pf-price-growth');
  var pfCapitalRaise = document.getElementById('pf-capital-raise');
  var pfRevShare = document.getElementById('pf-rev-share');

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
    var wells = getWellListWithProforma();
    // Only run if at least one well has cost + WI filled in
    var proformaWells = [];
    for (var i = 0; i < wells.length; i++) {
      if (wells[i].year1Cost > 0 && wells[i].ownership > 0) {
        proformaWells.push(wells[i]);
      }
    }
    if (proformaWells.length === 0) {
      proformaOutput.innerHTML = '';
      proformaOutput.style.display = 'none';
      return;
    }
    var globals = getProformaGlobals();
    var wellProformas = [];
    for (var j = 0; j < proformaWells.length; j++) {
      wellProformas.push(calculateWellProforma(proformaWells[j], globals));
    }
    var fundRollup = calculateFundProforma(wellProformas, globals);
    renderProformaOutput(wellProformas, fundRollup, globals, proformaOutput);
  }

  // Run proforma button
  document.getElementById('btn-pf-run').addEventListener('click', function() {
    runProforma();
    if (proformaOutput.offsetParent !== null) {
      proformaOutput.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

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
