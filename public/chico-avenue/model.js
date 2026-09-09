/*
 * Chico Avenue Portfolio: investor pro forma engine.
 *
 * A faithful port of the two live underwriting models (1017 Esplanade and
 * Royal Arms, "Pro Forma" tabs, September 2026). At the underwriting
 * assumptions it reproduces each model's 10-year LP IRR, distributions,
 * refinance proceeds and sale analysis to within rounding.
 *
 * Every dollar figure below comes straight from the models. Do not edit the
 * numbers by hand; re-pull them from the sheets and update here.
 */
(function (root) {
  'use strict';

  var PROPERTIES = {
    p1017: {
      id: 'p1017',
      name: '1017 Esplanade',
      alias: 'Palm Manor',
      units: 12,
      built: 1973,
      price: 1450000,
      sellerCredit: 75000,
      loan: 975000,
      rate: 0.066,
      ioMonths: 12,
      amortMonths: 300,
      rentCurrent: 168600,
      rentMarket: 181200,
      rentTarget: 202200,
      laundry: 4650,
      rubs: 6480,
      rehab: 225000,
      closingCosts: 37095,
      reserves: 32011,
      refiYears: [5, 9],
      expenses: [
        { key: 'Electric & gas', v: 5665.14 },
        { key: 'Pest control', v: 1230 },
        { key: 'Insurance', v: 5244 },
        { key: 'Legal & accounting', v: 2500 },
        { key: 'Real estate taxes', v: 16675 },
        { key: 'Landscaping', v: 1920 },
        { key: 'Trash', v: 4085.25 },
        { key: 'Repairs & maintenance', v: 6000 },
        { key: 'Turnover', v: 3000 },
        { key: 'Water & sewer', v: 3149.16 },
        { key: 'Other', v: 190.5 },
        { key: 'Replacement reserve', v: 4800 }
      ],
      turnoverYearOneOnly: false,
      mix: [
        { type: 'Studio', n: 1, current: 775, market: 950, target: 1100 },
        { type: '1 BD / 1 BA', n: 1, current: 975, market: 1150, target: 1250 },
        { type: '2 BD / 2 BA', n: 10, current: 1230, market: 1300, target: 1450 }
      ]
    },
    ra: {
      id: 'ra',
      name: 'Royal Arms',
      alias: '1120 Esplanade',
      units: 24,
      built: 1962,
      price: 2760000,
      sellerCredit: 154000,
      loan: 1696500,
      rate: 0.065,
      ioMonths: 60,
      amortMonths: 360,
      rentCurrent: 303360,
      rentMarket: 350220,
      rentTarget: 382800,
      laundry: 6000,
      rubs: 14400,
      rehab: 371885.5,
      closingCosts: 51361,
      reserves: 116840,
      refiYears: [4, 9],
      expenses: [
        { key: 'Pool maintenance', v: 4035 },
        { key: 'Electric & gas', v: 6000 },
        { key: 'Pest control', v: 1500 },
        { key: 'Insurance', v: 20377 },
        { key: 'Legal & accounting', v: 2500 },
        { key: 'Real estate taxes', v: 31740 },
        { key: 'Landscaping', v: 2160 },
        { key: 'Trash', v: 6229 },
        { key: 'Repairs & maintenance', v: 12000 },
        { key: 'Turnover', v: 6000 },
        { key: 'Water & sewer', v: 4628 },
        { key: 'Replacement reserve', v: 9600 }
      ],
      turnoverYearOneOnly: true,
      mix: [
        { type: '1 BD / 1 BA', n: 13, current: 950, market: 1150, target: 1250 },
        { type: '2 BD / 1 BA', n: 10, current: 1153, market: 1275, target: 1400 },
        { type: '3 BD / 2 BA', n: 1, current: 1400, market: 1485, target: 1650 }
      ]
    }
  };

  /* Underwriting (base case) assumptions, shared by both models. */
  var UNDERWRITING = {
    rentAdj: 0,        // stabilized (year 3+) rent vs. underwriting, fraction
    rentGrowth: 0.03,  // annual rent + other income growth from year 4
    vacancy: 0.04,     // physical vacancy, share of gross potential rent
    creditLoss: 0.03,  // concessions, loss to lease, bad debt (held constant)
    expGrowth: 0.025,  // annual expense growth
    taxGrowth: 0.02,   // Prop 13 cap on assessed-value growth
    capRate: 0.065,    // valuation cap rate for refinance sizing and exit
    rateDelta: 0,      // shift applied to both acquisition loan rates
    refiRate: 0.065,   // rate on refinance loans
    refiLTV: 0.65,     // refinance loan-to-value
    refiOn: true,      // model the refinances at all
    hold: 10,          // sale at end of this year
    rehabOverrun: 0,   // renovation budget vs. plan, fraction
    mgmtPct: 0.055,    // property management, share of EGI
    amPct: 0.01,       // asset management, share of EGI
    acqFeePct: 0.02,   // acquisition fee, share of contract price
    refiFeePct: 0.01,  // capital event fee, share of new loan
    refiCostPct: 0.01, // refinance closing costs, share of new loan
    saleCostPct: 0.04, // cost of sale
    lpSplit: 0.8
  };

  function pmt(rateMonthly, n, principal) {
    if (rateMonthly === 0) return principal / n;
    return principal * rateMonthly / (1 - Math.pow(1 + rateMonthly, -n));
  }

  function irr(flows) {
    // Newton with bisection fallback. Returns null if no sign change.
    var hasNeg = false, hasPos = false;
    for (var i = 0; i < flows.length; i++) { if (flows[i] < 0) hasNeg = true; if (flows[i] > 0) hasPos = true; }
    if (!hasNeg || !hasPos) return null;
    function npv(r) { var s = 0; for (var t = 0; t < flows.length; t++) s += flows[t] / Math.pow(1 + r, t); return s; }
    var lo = -0.99, hi = 10, mid;
    var fLo = npv(lo), fHi = npv(hi);
    if (fLo * fHi > 0) return null;
    for (var k = 0; k < 200; k++) {
      mid = (lo + hi) / 2;
      var fm = npv(mid);
      if (Math.abs(fm) < 1e-7) break;
      if (fLo * fm < 0) { hi = mid; fHi = fm; } else { lo = mid; fLo = fm; }
    }
    return mid;
  }

  function runProperty(p, A) {
    var N = A.hold;
    var y, m;
    var out = {
      id: p.id, name: p.name, units: p.units,
      years: [], equity: 0, sources: {}, uses: {}
    };

    /* Sources and uses */
    var rehab = p.rehab * (1 + A.rehabOverrun);
    var acqFee = p.price * A.acqFeePct;
    var downPayment = p.price - p.loan;
    var equity = downPayment + rehab + p.closingCosts + p.reserves + acqFee - p.sellerCredit;
    out.equity = equity;
    out.uses = {
      price: p.price, sellerCredit: p.sellerCredit, rehab: rehab,
      closingCosts: p.closingCosts, reserves: p.reserves, acqFee: acqFee,
      total: p.price - p.sellerCredit + rehab + p.closingCosts + p.reserves + acqFee
    };
    out.sources = { loan: p.loan, equity: equity };

    /* Income and expenses by year (index 1..N) */
    var gpr = [0], egi = [0], noi = [0], exp = [0];
    var targetAdj = p.rentTarget * (1 + A.rentAdj);
    for (y = 1; y <= N; y++) {
      var g;
      if (y === 1) g = p.rentCurrent;
      else if (y === 2) g = Math.min(p.rentMarket, targetAdj);
      else if (y === 3) g = targetAdj;
      else g = gpr[y - 1] * (1 + A.rentGrowth);
      gpr[y] = g;
      var otherIncome = (p.laundry + p.rubs) * Math.pow(1 + A.rentGrowth, y - 1);
      var e = g * (1 - A.vacancy - A.creditLoss) + otherIncome;
      egi[y] = e;
      var x = 0;
      for (var i = 0; i < p.expenses.length; i++) {
        var line = p.expenses[i];
        if (line.key === 'Turnover' && p.turnoverYearOneOnly && y > 1) continue;
        // Real estate taxes are capped at 2% a year under Prop 13; everything else follows the expense lever.
        var growth = line.key === 'Real estate taxes' ? A.taxGrowth : A.expGrowth;
        x += line.v * Math.pow(1 + growth, y - 1);
      }
      x += A.mgmtPct * e;
      exp[y] = x;
      noi[y] = e - x;
    }

    /* Debt, refinances, distributions */
    var loan = { bal: p.loan, rate: p.rate + A.rateDelta, ioLeft: p.ioMonths, pay: 0, label: 'Acquisition loan' };
    // The models amortize over the amortization term less the interest-only months.
    loan.pay = pmt(loan.rate / 12, p.amortMonths - p.ioMonths, p.loan);
    var capBal = equity;
    var totalLP = 0, totalRefiRoc = 0;

    for (y = 1; y <= N; y++) {
      var row = { year: y, gpr: gpr[y], egi: egi[y], expenses: exp[y], noi: noi[y] };
      row.capBegin = capBal;
      row.refiProceeds = 0; row.refiFees = 0; row.roc = 0; row.refiExcess = 0; row.refiLoan = 0;

      /* Refinance at the beginning of the year, sized on prior-year NOI */
      if (A.refiOn && y > 1 && p.refiYears.indexOf(y) !== -1) {
        var value = noi[y - 1] / A.capRate;
        var newLoan = A.refiLTV * value;
        if (newLoan > loan.bal) {
          var cashOut = newLoan - loan.bal;
          var fees = newLoan * (A.refiFeePct + A.refiCostPct);
          var net = cashOut - fees;
          row.refiLoan = newLoan; row.refiProceeds = cashOut; row.refiFees = fees;
          if (net > 0) {
            var roc = Math.min(net, capBal);
            row.roc = roc;
            row.refiExcess = net - roc;
            capBal -= roc;
          }
          loan = { bal: newLoan, rate: A.refiRate, ioLeft: 0, pay: pmt(A.refiRate / 12, 360, newLoan), label: 'Refinance ' + y };
        }
      }

      /* Twelve months of debt service */
      var interest = 0, principal = 0;
      for (m = 0; m < 12; m++) {
        var iM = loan.bal * loan.rate / 12;
        interest += iM;
        if (loan.ioLeft > 0) { loan.ioLeft--; }
        else { var pM = loan.pay - iM; principal += pM; loan.bal -= pM; }
      }
      row.interest = interest; row.principal = principal; row.debtService = interest + principal;
      row.loanEnd = loan.bal;
      row.dscr = row.debtService > 0 ? noi[y] / row.debtService : null;
      row.value = noi[y] / A.capRate;

      /* Cash flow waterfall */
      row.cashFlow = noi[y] - row.debtService;
      row.amFee = A.amPct * egi[y];
      var splittable = row.cashFlow - row.amFee;
      row.lpCash = Math.max(0, A.lpSplit * splittable) + A.lpSplit * row.refiExcess;
      row.gpCash = Math.max(0, (1 - A.lpSplit) * splittable) + (1 - A.lpSplit) * row.refiExcess;
      row.cocOnCapital = row.capBegin > 0 ? row.lpCash / row.capBegin : 0;
      row.capEnd = capBal;

      /* Hypothetical sale at the end of this year */
      var saleCost = row.value * A.saleCostPct;
      var proceeds = row.value - loan.bal - saleCost;
      var lpRoc = Math.min(Math.max(proceeds, 0), capBal);
      var splitSale = Math.max(0, proceeds - capBal);
      row.saleValue = row.value; row.saleProceeds = proceeds;
      row.lpSale = lpRoc + A.lpSplit * splitSale;
      row.gpSale = (1 - A.lpSplit) * splitSale;

      row.lpTotal = row.lpCash + row.roc;
      totalLP += row.lpTotal;
      totalRefiRoc += row.roc;
      out.years.push(row);
    }

    var last = out.years[N - 1];
    var flows = [-equity];
    for (y = 1; y <= N; y++) flows.push(out.years[y - 1].lpTotal + (y === N ? last.lpSale : 0));
    out.flows = flows;
    out.irr = irr(flows);
    out.totalDistributions = totalLP + last.lpSale;
    out.multiple = out.totalDistributions / equity;
    out.refiRoc = totalRefiRoc;
    out.saleProceedsLP = last.lpSale;
    return out;
  }

  function runPortfolio(selection, assumptions) {
    var A = {};
    for (var k in UNDERWRITING) A[k] = UNDERWRITING[k];
    for (var k2 in assumptions) if (assumptions[k2] !== undefined) A[k2] = assumptions[k2];
    var ids = selection === 'both' ? ['p1017', 'ra'] : [selection];
    var props = ids.map(function (id) { return runProperty(PROPERTIES[id], A); });
    var N = A.hold;
    var res = { assumptions: A, properties: props, equity: 0, units: 0, years: [] };
    props.forEach(function (p) { res.equity += p.equity; res.units += p.units; });
    for (var y = 1; y <= N; y++) {
      var row = { year: y, noi: 0, egi: 0, debtService: 0, cashFlow: 0, lpCash: 0, roc: 0, lpSale: 0, capBegin: 0, capEnd: 0, value: 0, loanEnd: 0, lpTotal: 0 };
      props.forEach(function (p) {
        var r = p.years[y - 1];
        row.noi += r.noi; row.egi += r.egi; row.debtService += r.debtService; row.cashFlow += r.cashFlow;
        row.lpCash += r.lpCash; row.roc += r.roc; row.capBegin += r.capBegin; row.capEnd += r.capEnd;
        row.value += r.value; row.loanEnd += r.loanEnd; row.lpTotal += r.lpTotal;
        if (y === N) row.lpSale += r.lpSale;
      });
      row.dscr = row.debtService > 0 ? row.noi / row.debtService : null;
      row.cocOnEquity = row.lpCash / res.equity;
      row.cocOnCapital = row.capBegin > 0 ? row.lpCash / row.capBegin : 0;
      res.years.push(row);
    }
    var flows = [-res.equity];
    var totalLP = 0, totalRoc = 0, sumCoc = 0;
    res.years.forEach(function (r) { flows.push(r.lpTotal + r.lpSale); totalLP += r.lpTotal + r.lpSale; totalRoc += r.roc; sumCoc += r.cocOnEquity; });
    res.flows = flows;
    res.irr = irr(flows);
    res.totalDistributions = totalLP;
    res.multiple = totalLP / res.equity;
    res.y1Coc = res.years[0].cocOnEquity;
    res.avgCoc = sumCoc / N; // average annual cash yield on original equity
    res.refiRoc = totalRoc;
    res.refiRocPct = totalRoc / res.equity;
    res.saleProceedsLP = res.years[N - 1].lpSale;
    res.y1Noi = res.years[0].noi;
    res.stabNoi = res.years[Math.min(2, N - 1)].noi;
    res.totalCost = 0; res.totalLoan = 0; res.basisCost = 0;
    props.forEach(function (p) { res.totalCost += p.uses.total; res.totalLoan += p.sources.loan; res.basisCost += p.uses.price - p.uses.sellerCredit + p.uses.rehab + p.uses.acqFee; });
    // Yield on cost as the deck defines it: stabilized (year 3) NOI over net price, renovation and acquisition fee.
    res.yieldOnCost = res.stabNoi / res.basisCost;
    return res;
  }

  var api = { PROPERTIES: PROPERTIES, UNDERWRITING: UNDERWRITING, runProperty: runProperty, runPortfolio: runPortfolio, irr: irr };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CAP_MODEL = api;
})(typeof window !== 'undefined' ? window : globalThis);
