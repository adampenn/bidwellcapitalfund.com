/**
 * Proforma Financial Engine — Oil Fund 6 Rush Creek
 *
 * Two well model types:
 *   - Gas Drive: Newby wells. Simple decline from IP, no water costs.
 *   - Water Drive: Amarada / Medicine Crow wells. Water production + disposal costs.
 *
 * Data sourced from Oil Fund 6 - Rush Creek Proforma.xlsx
 */

/* ==========================================================
   WELL DATABASE — Real well data from the proforma
   ========================================================== */

var PROFORMA_WELLS = [
  {
    name: 'Amarada East #1', legalName: 'Buxton 1', apiNumber: '3513300185',
    driveType: 'water', year1Cost: 200000, ownership: 0.16, nri: 0.75,
    depletionAllowance: 0.15, fluidBPD: 2000, waterCut: 0.96, ipOilBPD: 80,
    loeMonthlyCost: 3000,
    declineRates: [null, 0.15, 0.10, 0.07, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
    waterDisposalPrices: [0.50, 0.50, 0.50, 0.75, 0.75, 0.75, 1.00, 1.00, 1.00, 1.00]
  },
  {
    name: 'Amarada West #1', legalName: 'Buxton 2', apiNumber: '3513300205',
    driveType: 'water', year1Cost: 200000, ownership: 0.16, nri: 0.75,
    depletionAllowance: 0.15, fluidBPD: 2000, waterCut: 0.96, ipOilBPD: 80,
    loeMonthlyCost: 3000,
    declineRates: [null, 0.15, 0.10, 0.07, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
    waterDisposalPrices: [0.50, 0.50, 0.50, 0.75, 0.75, 0.75, 1.00, 1.00, 1.00, 1.00]
  },
  {
    name: 'Newby 27-7', legalName: 'NE Newby Unit 27-7', apiNumber: '3503700497',
    driveType: 'gas', year1Cost: 25000, ownership: 0.02625, nri: 0.75,
    depletionAllowance: 0.30, ipOilBPD: 30, loeMonthlyCost: 2000,
    declineRates: [null, 0.50, 0.05, 0.05, 0.04, 0.04, 0.03, 0.03, 0.03, 0.03]
  },
  {
    name: 'Newby 27-8', legalName: 'Newby 27-8', apiNumber: '3503700507',
    driveType: 'gas', year1Cost: 25000, ownership: 0.02625, nri: 0.75,
    depletionAllowance: 0.30, ipOilBPD: 30, loeMonthlyCost: 2000,
    declineRates: [null, 0.50, 0.05, 0.05, 0.04, 0.04, 0.03, 0.03, 0.03, 0.03]
  },
  {
    name: 'Newby 27-9', legalName: 'Newby 27-9', apiNumber: '3503700520',
    driveType: 'gas', year1Cost: 175000, ownership: 0.18375, nri: 0.75,
    depletionAllowance: 0.30, ipOilBPD: 30, loeMonthlyCost: 2000,
    declineRates: [null, 0.50, 0.05, 0.05, 0.04, 0.04, 0.03, 0.03, 0.03, 0.03]
  },
  {
    name: 'Newby 34-2', legalName: 'RCR Newby 34-2', apiNumber: '3503700341',
    driveType: 'gas', year1Cost: 200000, ownership: 0.21, nri: 0.75,
    depletionAllowance: 0.30, ipOilBPD: 30, loeMonthlyCost: 2000,
    declineRates: [null, 0.50, 0.05, 0.05, 0.04, 0.04, 0.03, 0.03, 0.03, 0.03]
  },
  {
    name: 'Newby 34-3', legalName: 'RCR Newby 34-3', apiNumber: '3503700499',
    driveType: 'gas', year1Cost: 200000, ownership: 0.21, nri: 0.75,
    depletionAllowance: 0.30, ipOilBPD: 60, loeMonthlyCost: 2000,
    declineRates: [null, 0.50, 0.05, 0.05, 0.04, 0.04, 0.03, 0.03, 0.03, 0.03]
  },
  {
    name: 'Newby 34-4', legalName: 'Newby 34-4', apiNumber: '3503700518',
    driveType: 'gas', year1Cost: 225000, ownership: 0.23625, nri: 0.75,
    depletionAllowance: 0.30, ipOilBPD: 60, loeMonthlyCost: 2000,
    declineRates: [null, 0.50, 0.05, 0.05, 0.04, 0.04, 0.03, 0.03, 0.03, 0.03]
  },
  {
    name: 'Medicine Crow 33-1', legalName: 'Medicine Crow 33-1', apiNumber: 'TBD',
    driveType: 'water', year1Cost: 175000, ownership: 0.16095, nri: 0.75,
    depletionAllowance: 0.15, fluidBPD: 200, waterCut: 0.60, ipOilBPD: 80,
    loeMonthlyCost: 3000,
    declineRates: [null, 0.50, 0.50, 0.10, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
    waterDisposalPrices: [0.50, 0.50, 0.50, 0.75, 0.75, 0.75, 1.00, 1.00, 1.00, 1.00]
  }
];

/* ==========================================================
   WELL TYPE TEMPLATES — for modeling new/hypothetical wells
   ========================================================== */

var WELL_TYPE_TEMPLATES = {
  'gas-standard': {
    label: 'Gas Drive — Standard (30 BPD IP)',
    driveType: 'gas', ipOilBPD: 30, nri: 0.75, depletionAllowance: 0.30,
    loeMonthlyCost: 2000,
    declineRates: [null, 0.50, 0.05, 0.05, 0.04, 0.04, 0.03, 0.03, 0.03, 0.03]
  },
  'gas-high': {
    label: 'Gas Drive — High IP (60 BPD)',
    driveType: 'gas', ipOilBPD: 60, nri: 0.75, depletionAllowance: 0.30,
    loeMonthlyCost: 2000,
    declineRates: [null, 0.50, 0.05, 0.05, 0.04, 0.04, 0.03, 0.03, 0.03, 0.03]
  },
  'water-amarada': {
    label: 'Water Drive — High Volume (Amarada-type)',
    driveType: 'water', fluidBPD: 2000, waterCut: 0.96, ipOilBPD: 80,
    nri: 0.75, depletionAllowance: 0.15, loeMonthlyCost: 3000,
    declineRates: [null, 0.15, 0.10, 0.07, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
    waterDisposalPrices: [0.50, 0.50, 0.50, 0.75, 0.75, 0.75, 1.00, 1.00, 1.00, 1.00]
  },
  'water-shallow': {
    label: 'Water Drive — Shallow (Medicine Crow-type)',
    driveType: 'water', fluidBPD: 200, waterCut: 0.60, ipOilBPD: 80,
    nri: 0.75, depletionAllowance: 0.15, loeMonthlyCost: 3000,
    declineRates: [null, 0.50, 0.50, 0.10, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
    waterDisposalPrices: [0.50, 0.50, 0.50, 0.75, 0.75, 0.75, 1.00, 1.00, 1.00, 1.00]
  }
};

/* ==========================================================
   GLOBAL FINANCIAL DEFAULTS
   ========================================================== */

var PROFORMA_DEFAULTS = {
  oilPrice: 60.00,
  wellUptime: 0.90,
  priceGrowth: 0,
  severanceTaxRate: 0.07,
  loeEscalation: 0.05,
  revShare: 0.20,
  capitalRaise: 1450000,
  projectionYears: 10
};

/* ==========================================================
   PROFORMA CALCULATION ENGINE
   ========================================================== */

/**
 * Calculate a 10-year proforma for a single well.
 * Returns an object with yearly arrays for all financial metrics.
 */
function calculateWellProforma(well, globals) {
  var g = Object.assign({}, PROFORMA_DEFAULTS, globals || {});
  var years = g.projectionYears || 10;
  var result = {
    well: well,
    years: years,
    oilProduction: [],
    proratedProduction: [],
    waterProduction: [],
    salePrice: [],
    grossSales: [],
    nriRevenue: [],
    proratedNRI: [],
    severanceTax: [],
    waterDisposal: [],
    otherLOE: [],
    totalLOE: [],
    proratedLOE: [],
    noi: [],
    proratedNOI: [],
    cocr: [],
    cumulativeROI: [],
    depletionDeduction: [],
    taxableIncome: []
  };

  var isWater = well.driveType === 'water';

  for (var yr = 0; yr < years; yr++) {
    // Oil production
    var oil;
    if (yr === 0) {
      oil = 365 * g.wellUptime * well.ipOilBPD;
    } else {
      var decline = well.declineRates[yr] || 0.03;
      oil = result.oilProduction[yr - 1] * (1 - decline);
    }
    result.oilProduction.push(oil);
    result.proratedProduction.push(oil * well.ownership);

    // Water production (water drive only)
    if (isWater) {
      result.waterProduction.push(oil / (1 - well.waterCut));
    } else {
      result.waterProduction.push(0);
    }

    // Sale price with growth
    var price = yr === 0 ? g.oilPrice : result.salePrice[yr - 1] * (1 + g.priceGrowth);
    result.salePrice.push(price);

    // Revenue
    var gross = price * oil;
    var nri = gross * well.nri;
    result.grossSales.push(gross);
    result.nriRevenue.push(nri);
    result.proratedNRI.push(nri * well.ownership);

    // Expenses
    var sevTax = g.severanceTaxRate * nri;
    result.severanceTax.push(sevTax);

    var waterDisp = 0;
    if (isWater && well.waterDisposalPrices) {
      waterDisp = (well.waterDisposalPrices[yr] || 1.0) * result.waterProduction[yr];
    }
    result.waterDisposal.push(waterDisp);

    var otherLOE;
    if (yr === 0) {
      otherLOE = well.loeMonthlyCost * 12;
    } else {
      otherLOE = result.otherLOE[yr - 1] * (1 + g.loeEscalation);
    }
    result.otherLOE.push(otherLOE);

    // Total LOE and NOI differ by well type
    var totalLOE, noi;
    if (isWater) {
      // Water drive: severance tax is NOT deducted from NOI (matches spreadsheet)
      totalLOE = -(waterDisp + otherLOE);
      noi = nri + totalLOE;
    } else {
      // Gas drive: severance tax IS deducted from NOI
      totalLOE = -sevTax + (-otherLOE);
      noi = nri + (-sevTax) + (-otherLOE);
    }
    result.totalLOE.push(totalLOE);
    result.proratedLOE.push(totalLOE * well.ownership);
    result.noi.push(noi);
    result.proratedNOI.push(noi * well.ownership);

    // Returns
    var cocr = well.year1Cost > 0 ? (noi * well.ownership) / well.year1Cost : 0;
    result.cocr.push(cocr);
    result.cumulativeROI.push(yr === 0 ? cocr : result.cumulativeROI[yr - 1] + cocr);

    // Tax
    var depletion = well.depletionAllowance * nri * well.ownership;
    result.depletionDeduction.push(depletion);
    result.taxableIncome.push((noi * well.ownership) - depletion);
  }

  return result;
}

/**
 * Calculate fund-level rollup from individual well proformas.
 */
function calculateFundProforma(wellProformas, globals) {
  var g = Object.assign({}, PROFORMA_DEFAULTS, globals || {});
  var years = g.projectionYears || 10;

  var fund = {
    years: years,
    totalProduction: [],
    totalIncome: [],
    totalLOE: [],
    netIncome: [],
    lpReturns: [],
    gpRevShare: [],
    roi: [],
    totalReturn: []
  };

  for (var yr = 0; yr < years; yr++) {
    var prod = 0, income = 0, loe = 0, net = 0;
    for (var w = 0; w < wellProformas.length; w++) {
      prod += wellProformas[w].proratedProduction[yr];
      income += wellProformas[w].proratedNRI[yr];
      loe += wellProformas[w].proratedLOE[yr];
      net += wellProformas[w].proratedNOI[yr];
    }
    fund.totalProduction.push(prod);
    fund.totalIncome.push(income);
    fund.totalLOE.push(loe);
    fund.netIncome.push(net);
    fund.lpReturns.push(net * (1 - g.revShare));
    fund.gpRevShare.push(net * g.revShare);
    fund.roi.push(g.capitalRaise > 0 ? net / g.capitalRaise : 0);
    fund.totalReturn.push(yr === 0 ? (g.capitalRaise > 0 ? net / g.capitalRaise : 0) : fund.totalReturn[yr - 1] + (g.capitalRaise > 0 ? net / g.capitalRaise : 0));
  }

  return fund;
}
