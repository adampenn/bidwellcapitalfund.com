/**
 * Oklahoma Oil Well Development Timeline — Configuration
 * All constants, presets, weather data, and phase definitions.
 */

var ACCESS_PASSWORD = 'bidwell2025';

var DEFAULT_ASSUMPTIONS = {
  preDrill: 21, rigMob: 2, sitePrep: 1, drillSurface: 2, drillTD: 5,
  logEval: 1, runCasing: 1, perforate: 2, acidize: 2, swabTest: 3,
  facilities: 60, fracBuffer: 7, fracExec: 3, drillOut: 3, flowback: 10, stabilized: 15
};

var SCENARIO_PRESETS = {
  fast: {
    preDrill: 14, rigMob: 1, sitePrep: 1, drillSurface: 1, drillTD: 3,
    logEval: 1, runCasing: 1, perforate: 1, acidize: 1, swabTest: 2,
    facilities: 45, fracBuffer: 3, fracExec: 2, drillOut: 2, flowback: 7, stabilized: 10
  },
  base: Object.assign({}, DEFAULT_ASSUMPTIONS),
  conservative: {
    preDrill: 30, rigMob: 3, sitePrep: 2, drillSurface: 3, drillTD: 8,
    logEval: 2, runCasing: 2, perforate: 3, acidize: 3, swabTest: 5,
    facilities: 90, fracBuffer: 14, fracExec: 5, drillOut: 5, flowback: 14, stabilized: 21
  }
};

var PHASE_COLORS = {
  preDrill: '#94a3b8', rigMob: '#60a5fa', sitePrep: '#60a5fa',
  drillSurface: '#3b82f6', drillTD: '#2563eb', logEval: '#3b82f6', runCasing: '#3b82f6',
  perforate: '#f59e0b', acidize: '#f59e0b', swabTest: '#d97706',
  facilities: '#8b5cf6', fracBuffer: '#a3a3a3',
  fracExec: '#10b981', drillOut: '#10b981', flowback: '#059669', stabilized: '#065f46'
};

var PHASE_NAMES = {
  preDrill: 'Pre-drill / Permitting', rigMob: 'Rig Mobilization',
  sitePrep: 'Site Prep / Rig Up', drillSurface: 'Drill Surface + Casing',
  drillTD: 'Drill to TD', logEval: 'Log & Evaluate',
  runCasing: 'Run Production Casing', perforate: 'Perforate',
  acidize: 'Acidize / Stimulate', swabTest: 'Swab / Flow Test',
  facilities: 'Facilities / Infrastructure', fracBuffer: 'Frac Scheduling Buffer',
  fracExec: 'Frac Execution', drillOut: 'Drill Out / Cleanup',
  flowback: 'Flowback', stabilized: 'Stabilized Production'
};

var PHASE_CATEGORY = {
  preDrill: 'Permitting',
  rigMob: 'Drilling', sitePrep: 'Drilling', drillSurface: 'Drilling',
  drillTD: 'Drilling', logEval: 'Drilling', runCasing: 'Drilling',
  perforate: 'Completion Prep', acidize: 'Completion Prep', swabTest: 'Completion Prep',
  facilities: 'Facilities',
  fracBuffer: 'Frac & Completion', fracExec: 'Frac & Completion', drillOut: 'Frac & Completion',
  flowback: 'Production', stabilized: 'Production'
};

var LEGEND_ITEMS = [
  { label: 'Pre-drill', color: '#94a3b8' },
  { label: 'Drilling', color: '#3b82f6' },
  { label: 'Completion Prep', color: '#f59e0b' },
  { label: 'Facilities', color: '#8b5cf6' },
  { label: 'Frac & Completion', color: '#10b981' },
  { label: 'Flowback / Production', color: '#065f46' }
];

var WEATHER_DELAY_DAYS = {
  average: {
    field:  [3.5, 2.5, 1.5, 1.5, 2.5, 1.8, 1.2, 1.2, 1.0, 0.7, 0.8, 2.8],
    indoor: [1.5, 1.0, 0.5, 0.3, 0.5, 0.3, 0.0, 0.0, 0.0, 0.2, 0.3, 1.2]
  },
  optimistic: {
    field:  [2.0, 1.5, 1.0, 0.8, 1.5, 1.0, 0.5, 0.5, 0.5, 0.3, 0.5, 1.5],
    indoor: [0.8, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5]
  },
  conservative: {
    field:  [6.0, 4.5, 2.5, 2.5, 4.0, 3.0, 1.5, 1.5, 1.5, 1.5, 2.0, 5.0],
    indoor: [3.0, 2.0, 1.0, 0.8, 1.0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.8, 2.5]
  }
};

var INDOOR_PHASES = ['preDrill', 'facilities', 'fracBuffer'];
