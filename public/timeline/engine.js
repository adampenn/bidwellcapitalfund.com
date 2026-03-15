/**
 * Timeline Schedule Calculation Engine
 * Generates well development schedules with weather delays.
 */

function calcWeatherDelay(startDate, endDate, phaseKey, riskProfile) {
  if (!riskProfile || riskProfile === 'none') return 0;
  var profile = WEATHER_DELAY_DAYS[riskProfile] || WEATHER_DELAY_DAYS.average;
  var isIndoor = INDOOR_PHASES.indexOf(phaseKey) !== -1;
  var rates = isIndoor ? profile.indoor : profile.field;

  var totalDelay = 0;
  var cursor = new Date(startDate);
  var end = new Date(endDate);

  while (cursor <= end) {
    var month = cursor.getMonth();
    var daysInMonth = new Date(cursor.getFullYear(), month + 1, 0).getDate();
    var monthEnd = new Date(cursor.getFullYear(), month + 1, 0);
    var spanEnd = end < monthEnd ? end : monthEnd;
    var daysInSpan = daysBetween(cursor, spanEnd) + 1;
    var fraction = daysInSpan / daysInMonth;
    totalDelay += rates[month] * fraction;
    cursor = addDays(spanEnd, 1);
  }

  return Math.round(totalDelay);
}

function generateSchedule(opts) {
  var startDate = opts.startDate;
  var wellDefs = opts.wellDefs;
  var numWells = wellDefs.length;
  var mode = opts.mode;
  var overlapOffset = opts.overlapOffset;
  var globalBuffer = opts.globalBuffer;
  var a = opts.assumptions;
  var weatherEnabled = opts.weatherEnabled;
  var weatherRisk = opts.weatherRisk;
  var totalWeatherDays = 0;

  // Investment/tax inputs
  var distLag = opts.distLag;
  var totalInvestment = opts.totalInvestment;
  var idcPct = opts.idcPct;
  var overheadPct = opts.overheadPct;
  var bonusDeprPct = opts.bonusDeprPct;

  if (numWells < 1) return null;

  var projectPhases = [];
  var wells = [];
  var wellNames = [];
  var allBars = [];
  var cursor = new Date(startDate);

  function makePhase(key, start, duration, wellName) {
    var baseDuration = duration;
    var weatherDays = 0;
    if (weatherEnabled && duration > 0) {
      var baseEnd = addDays(start, duration - 1);
      weatherDays = calcWeatherDelay(start, baseEnd, key, weatherRisk);
    }
    var totalDuration = duration + weatherDays;
    var end = addDays(start, totalDuration - 1);
    totalWeatherDays += weatherDays;
    return {
      key: key, name: PHASE_NAMES[key] || key, color: PHASE_COLORS[key] || '#888',
      category: PHASE_CATEGORY[key] || '', well: wellName || 'Project',
      start: new Date(start), end: end, duration: totalDuration,
      baseDuration: baseDuration, weatherDays: weatherDays
    };
  }

  var drillingStartBase = new Date(cursor);
  var drillingPhaseKeys = ['rigMob', 'sitePrep', 'drillSurface', 'drillTD', 'logEval', 'runCasing'];
  var completionPrepKeys = ['perforate', 'acidize', 'swabTest'];
  var postFracKeys = ['fracExec', 'drillOut', 'flowback', 'stabilized'];
  var wellFacilitiesEnd = [];

  var rigWells = {};
  for (var rw = 0; rw < wellDefs.length; rw++) {
    var rigNum = wellDefs[rw].rig;
    if (!rigWells[rigNum]) rigWells[rigNum] = [];
    rigWells[rigNum].push(rw);
  }

  var rigPrevWell = {};

  for (var w = 0; w < numWells; w++) {
    var wellName = wellDefs[w].name;
    var wellRig = wellDefs[w].rig;
    wellNames.push(wellName);
    var wellPhases = [];
    var wellCursor;

    var prevOnRig = rigPrevWell[wellRig];

    wellCursor = new Date(drillingStartBase);
    if (a.preDrill > 0) {
      var preDrill = makePhase('preDrill', drillingStartBase, a.preDrill, wellName);
      wellPhases.push(preDrill);
      allBars.push(preDrill);
      wellCursor = addDays(preDrill.end, 1);
    }

    if (prevOnRig !== undefined) {
      var rigReady;
      if (mode === 'sequential') {
        var prevWell = wells[prevOnRig];
        var prevLastDrilling = null;
        for (var p = 0; p < prevWell.length; p++) {
          if (drillingPhaseKeys.indexOf(prevWell[p].key) !== -1) prevLastDrilling = prevWell[p];
        }
        rigReady = addDays(prevLastDrilling.end, 1);
      } else {
        var prevDrillStart = null;
        for (var pd = 0; pd < wells[prevOnRig].length; pd++) {
          if (drillingPhaseKeys.indexOf(wells[prevOnRig][pd].key) !== -1) {
            prevDrillStart = wells[prevOnRig][pd].start;
            break;
          }
        }
        rigReady = addDays(prevDrillStart, overlapOffset);
      }
      if (rigReady > wellCursor) wellCursor = rigReady;
    }

    rigPrevWell[wellRig] = w;

    for (var d = 0; d < drillingPhaseKeys.length; d++) {
      var key = drillingPhaseKeys[d];
      if (a[key] > 0) {
        var phase = makePhase(key, wellCursor, a[key], wellName);
        wellPhases.push(phase);
        allBars.push(phase);
        wellCursor = addDays(phase.end, 1);
      }
    }

    for (var c = 0; c < completionPrepKeys.length; c++) {
      var ck = completionPrepKeys[c];
      if (a[ck] > 0) {
        var cp = makePhase(ck, wellCursor, a[ck], wellName);
        wellPhases.push(cp);
        allBars.push(cp);
        wellCursor = addDays(cp.end, 1);
      }
    }

    if (a.facilities > 0) {
      var facStart = wellCursor;
      for (var fc = 0; fc < wellPhases.length; fc++) {
        if (completionPrepKeys.indexOf(wellPhases[fc].key) !== -1) {
          facStart = new Date(wellPhases[fc].start);
          break;
        }
      }
      var facPhase = makePhase('facilities', facStart, a.facilities, wellName);
      wellPhases.push(facPhase);
      allBars.push(facPhase);
      wellFacilitiesEnd.push(facPhase.end);
    } else {
      wellFacilitiesEnd.push(null);
    }

    wells.push(wellPhases);
  }

  // Frac and post-frac phases per well
  for (var w2 = 0; w2 < numWells; w2++) {
    var wellName2 = wellNames[w2];
    var wellPhases2 = wells[w2];
    var lastCompletionPrep = null;

    for (var lc = 0; lc < wellPhases2.length; lc++) {
      if (completionPrepKeys.indexOf(wellPhases2[lc].key) !== -1) lastCompletionPrep = wellPhases2[lc];
    }

    var fracReadyDate;
    var completionEnd = lastCompletionPrep ? addDays(lastCompletionPrep.end, 1) : new Date(drillingStartBase);
    var thisFacEnd = wellFacilitiesEnd[w2] ? addDays(wellFacilitiesEnd[w2], 1) : completionEnd;
    fracReadyDate = completionEnd > thisFacEnd ? completionEnd : thisFacEnd;

    if (a.fracBuffer > 0) {
      var bufferPhase = makePhase('fracBuffer', fracReadyDate, a.fracBuffer, wellName2);
      wellPhases2.push(bufferPhase);
      allBars.push(bufferPhase);
      fracReadyDate = addDays(bufferPhase.end, 1);
    }

    var postCursor = fracReadyDate;
    for (var pf = 0; pf < postFracKeys.length; pf++) {
      var pfKey = postFracKeys[pf];
      if (a[pfKey] > 0) {
        var pfPhase = makePhase(pfKey, postCursor, a[pfKey], wellName2);
        wellPhases2.push(pfPhase);
        allBars.push(pfPhase);
        postCursor = addDays(pfPhase.end, 1);
      }
    }

    if (globalBuffer > 0) {
      var bufPhase = {
        key: 'globalBuffer', name: 'Buffer', color: '#d4d4d8',
        category: 'Buffer', well: wellName2,
        start: new Date(postCursor), end: addDays(postCursor, globalBuffer - 1),
        duration: globalBuffer
      };
      wellPhases2.push(bufPhase);
      allBars.push(bufPhase);
    }
  }

  var projectEnd = startDate;
  for (var b = 0; b < allBars.length; b++) {
    if (allBars[b].end > projectEnd) projectEnd = allBars[b].end;
  }

  var firstFlowback = null;
  for (var fb = 0; fb < allBars.length; fb++) {
    if (allBars[fb].key === 'flowback') {
      if (!firstFlowback || allBars[fb].start < firstFlowback) firstFlowback = allBars[fb].start;
    }
  }

  // Cashflow
  var lastFlowback = null, firstStabilized = null, lastStabilized = null;
  for (var cf = 0; cf < allBars.length; cf++) {
    if (allBars[cf].key === 'flowback') {
      if (!lastFlowback || allBars[cf].end > lastFlowback) lastFlowback = allBars[cf].end;
    }
    if (allBars[cf].key === 'stabilized') {
      if (!firstStabilized || allBars[cf].start < firstStabilized) firstStabilized = allBars[cf].start;
      if (!lastStabilized || allBars[cf].end > lastStabilized) lastStabilized = allBars[cf].end;
    }
  }

  var firstProductionMonth = firstFlowback ? new Date(firstFlowback.getFullYear(), firstFlowback.getMonth(), 1) : null;
  var lastProductionMonth = lastStabilized ? new Date(lastStabilized.getFullYear(), lastStabilized.getMonth(), 1) : null;
  var firstDistDate = firstProductionMonth ? addMonths(firstProductionMonth, distLag) : null;
  var lastProductionCheck = lastProductionMonth ? addMonths(lastProductionMonth, distLag) : null;

  var wellFlowbackDates = [];
  for (var wf = 0; wf < wells.length; wf++) {
    for (var wfp = 0; wfp < wells[wf].length; wfp++) {
      if (wells[wf][wfp].key === 'flowback') {
        wellFlowbackDates.push({ well: wellNames[wf], date: wells[wf][wfp].start });
        break;
      }
    }
  }

  var wellSpudDates = [];
  for (var ws = 0; ws < wells.length; ws++) {
    var spud = null;
    for (var wsp = 0; wsp < wells[ws].length; wsp++) {
      var sk = wells[ws][wsp].key;
      if (sk === 'rigMob' || sk === 'sitePrep' || sk === 'drillSurface') {
        if (!spud || wells[ws][wsp].start < spud) spud = wells[ws][wsp].start;
      }
    }
    wellSpudDates.push({ well: wellNames[ws], date: spud });
  }

  var firstSpudDate = null;
  for (var fsd = 0; fsd < wellSpudDates.length; fsd++) {
    if (wellSpudDates[fsd].date && (!firstSpudDate || wellSpudDates[fsd].date < firstSpudDate)) {
      firstSpudDate = wellSpudDates[fsd].date;
    }
  }

  // Tax
  var tdcPct = Math.max(0, 100 - idcPct - overheadPct);
  var idcAmount = totalInvestment * (idcPct / 100);
  var tdcAmount = totalInvestment * (tdcPct / 100);
  var overheadAmount = totalInvestment * (overheadPct / 100);
  var bonusDeprAmount = tdcAmount * (bonusDeprPct / 100);
  var remainingTdc = tdcAmount - bonusDeprAmount;
  var investmentYear = startDate.getFullYear();
  var march31NextYear = new Date(investmentYear + 1, 2, 31);
  var idcPerWell = numWells > 0 ? idcAmount / numWells : 0;

  var wellIdcStatus = [];
  var idcQualifyingAmount = 0, idcNonQualifyingAmount = 0;
  var wellsQualifying = 0, wellsNotQualifying = 0;

  for (var wi = 0; wi < wellSpudDates.length; wi++) {
    var wSpud = wellSpudDates[wi].date;
    var qualifies = wSpud && wSpud <= march31NextYear;
    wellIdcStatus.push({ well: wellSpudDates[wi].well, spudDate: wSpud, qualifies: qualifies, idcShare: idcPerWell });
    if (qualifies) { idcQualifyingAmount += idcPerWell; wellsQualifying++; }
    else { idcNonQualifyingAmount += idcPerWell; wellsNotQualifying++; }
  }

  var tdcPerWell = numWells > 0 ? tdcAmount / numWells : 0;
  var bonusDeprPerWell = numWells > 0 ? bonusDeprAmount / numWells : 0;
  var remainingTdcPerWell = numWells > 0 ? remainingTdc / numWells : 0;
  var tdcByYear = {};
  for (var ti = 0; ti < wellFlowbackDates.length; ti++) {
    var serviceYear = wellFlowbackDates[ti].date ? wellFlowbackDates[ti].date.getFullYear() : investmentYear;
    if (!tdcByYear[serviceYear]) tdcByYear[serviceYear] = { amount: 0, bonusDepr: 0, remaining: 0, wells: [] };
    tdcByYear[serviceYear].amount += tdcPerWell;
    tdcByYear[serviceYear].bonusDepr += bonusDeprPerWell;
    tdcByYear[serviceYear].remaining += remainingTdcPerWell;
    tdcByYear[serviceYear].wells.push(wellFlowbackDates[ti].well);
  }
  if (Object.keys(tdcByYear).length === 0) {
    tdcByYear[investmentYear] = { amount: tdcAmount, bonusDepr: bonusDeprAmount, remaining: remainingTdc, wells: [] };
  }

  return {
    startDate: startDate, endDate: projectEnd, numWells: numWells,
    mode: mode, overlapOffset: overlapOffset,
    totalDays: daysBetween(startDate, projectEnd) + 1,
    firstProductionDate: firstFlowback || projectEnd,
    finalStabilizedDate: projectEnd,
    projectPhases: projectPhases, wells: wells, wellNames: wellNames, allBars: allBars,
    assumptions: a,
    distLag: distLag, firstDistDate: firstDistDate,
    lastProductionCheck: lastProductionCheck, firstProductionMonth: firstProductionMonth,
    lastProductionMonth: lastProductionMonth, wellFlowbackDates: wellFlowbackDates,
    totalInvestment: totalInvestment, idcPct: idcPct, tdcPct: tdcPct,
    overheadPct: overheadPct, idcAmount: idcAmount, tdcAmount: tdcAmount,
    overheadAmount: overheadAmount, bonusDeprPct: bonusDeprPct,
    bonusDeprAmount: bonusDeprAmount, remainingTdc: remainingTdc,
    investmentYear: investmentYear, idcPerWell: idcPerWell,
    wellIdcStatus: wellIdcStatus, idcQualifyingAmount: idcQualifyingAmount,
    idcNonQualifyingAmount: idcNonQualifyingAmount,
    wellsQualifying: wellsQualifying, wellsNotQualifying: wellsNotQualifying,
    allQualify: wellsNotQualifying === 0, noneQualify: wellsQualifying === 0,
    firstSpudDate: firstSpudDate, wellSpudDates: wellSpudDates,
    march31Deadline: march31NextYear, tdcPerWell: tdcPerWell,
    tdcByYear: tdcByYear, tdcYears: Object.keys(tdcByYear).sort(),
    weatherEnabled: weatherEnabled, weatherRisk: weatherRisk, totalWeatherDays: totalWeatherDays
  };
}
