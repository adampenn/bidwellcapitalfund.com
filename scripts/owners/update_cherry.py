#!/usr/bin/env python3
"""Regenerate data/946-cherry.json from the 946 Cherry Asset Mgmt Google Sheet.

Reads via the `gog` CLI (must be authenticated). The sheet is the source of
truth; this script only transforms. Run monthly after updating the sheet:

    python3 scripts/update_cherry.py
    git add data/ && git commit -m "Monthly data: <month>" && git push
"""
import json
import re
import subprocess
import sys
from collections import OrderedDict
from pathlib import Path

SHEET_ID = "1mFb58dJGkTPzbUn2LHABlvHY4_IjnAoNWj0eGkJLQpw"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT.parent / "src" / "data" / "owners" / "946-cherry.json"
PRO_FORMA_MONTHLY_NOI = {1: 8072, 2: 8643}  # pro forma annual NOI / 12, by operating year
BASIS = 1_460_000  # purchase price
LP_CAPITAL = 485_000


def sheet(rng):
    res = subprocess.run(
        ["gog", "sheets", "get", SHEET_ID, rng, "--json"],
        capture_output=True, text=True,
    )
    if res.returncode != 0:
        # fall back to TSV output if --json is unsupported
        res = subprocess.run(
            ["gog", "sheets", "get", SHEET_ID, rng],
            capture_output=True, text=True, check=True,
        )
        return [line.split("\t") for line in res.stdout.splitlines()]
    return json.loads(res.stdout).get("values", [])


def money(s):
    s = str(s).replace("$", "").replace(",", "").strip()
    if s in ("", "-"):
        return None
    return float(s.replace("(", "-").replace(")", ""))


def main():
    # ---- P&L: month labels + NOI row -------------------------------------
    pnl = sheet("P&L Data!A1:Z80")
    months, noi = [], []
    for row in pnl:
        if row and row[0].strip() == "Line Item":
            months = [c.strip() for c in row[1:] if c.strip()]
        if row and row[0].strip() == "Net Operating Income":
            noi = [money(c) for c in row[1:len(months) + 1]]
    if not months or not noi:
        sys.exit("Could not locate month header or NOI row in P&L Data")
    # drop the partial closing month (first) and any trailing empty months
    series = [(m, v) for m, v in zip(months, noi) if v is not None][1:]
    labels = [m.split()[0] for m, _ in series]
    actual = [round(v) for _, v in series]
    op_month = len(series) + 1
    op_year = (op_month - 1) // 12 + 1

    # ---- Rent Roll: first full month vs latest month ---------------------
    rr = sheet("Rent Roll!A1:M2000")
    by_month = OrderedDict()
    for row in rr:
        if len(row) >= 5 and re.match(r"^[A-Z][a-z]{2} 20\d\d$", row[0].strip()):
            by_month.setdefault(row[0].strip(), []).append(row)
    month_keys = list(by_month.keys())
    first, latest = by_month[month_keys[0]], by_month[month_keys[-1]]
    first_by_unit = {r[1].strip(): r for r in first}

    units, s_from, s_to = [], 0, 0
    for r in sorted(latest, key=lambda r: int(r[1])):
        unit_no = r[1].strip()
        f = first_by_unit.get(unit_no)
        rent_from, rent_to = money(f[4]), money(r[4])
        tenant_from, tenant_to = f[2].strip(), r[2].strip()
        if tenant_from != tenant_to:
            kind = "turned"
        elif rent_to > rent_from:
            kind = "bump"
        else:
            kind = "pending"
        u = {"unit": f"Unit {unit_no}", "from": round(rent_from), "to": round(rent_to), "type": kind}
        units.append(u)
        s_from += rent_from
        s_to += rent_to

    # ---- Dashboard KPIs (auto-calculated by the sheet) -------------------
    dash = {r[0].strip(): r[1:] for r in sheet("Dashboard!A1:F60") if r}

    def dash_val(label, idx=0):
        row = dash.get(label)
        return row[idx].strip() if row and len(row) > idx else ""

    prev = json.loads(OUT.read_text()) if OUT.exists() else {}
    prev_tags = {u["unit"]: u["tag"] for u in prev.get("rentRoll", {}).get("units", []) if u.get("tag")}
    for u in units:
        if u["unit"] in prev_tags:
            u["tag"] = prev_tags[u["unit"]]

    t12 = money(dash_val("T-12 NOI (avg-to-date annualized)"))
    t12_var = dash_val("T-12 NOI (avg-to-date annualized)", 2).replace("%", "")
    implied = money(dash_val("Implied Value (T-12 NOI / cap)"))
    reserves = money(dash_val("Reserves Balance (cash)"))

    # Equity waterfall off implied value: loan payoff, LP capital back, 80/20 split.
    equity = prev.get("equity")
    loan = money(dash_val("Loan Balance"))
    if equity and implied and loan:
        profit = implied - loan - LP_CAPITAL
        equity = dict(equity, impliedValue=round(implied), segments=[
            {"label": "Loan payoff", "value": round(loan), "color": "gray"},
            {"label": "LP capital returned", "value": LP_CAPITAL, "color": "blue"},
            {"label": "LP profit share (80%)", "value": round(profit * 0.8), "color": "aqua"},
            {"label": "GP promote (20%)", "value": round(profit * 0.2), "color": "orange"},
        ])

    doc = {
        "id": "946-cherry",
        "name": "946 Cherry St",
        "city": "Chico, CA",
        "units": len(units),
        "asOf": month_keys[-1],
        "operatingMonth": op_month,
        "summary": prev.get("summary", ""),
        "kpis": [
            {"label": "T-12 NOI (annualized)",
             "value": f"${t12 / 1000:.1f}K" if t12 else "—",
             "delta": f"+{round(float(t12_var))}% vs pro forma" if t12_var else "",
             "good": True},
            {"label": "Occupancy", "value": dash_val("Occupancy %"), "delta": "", "good": True},
            {"label": "Avg scheduled rent", "value": f"${round(s_to / len(units))}",
             "delta": f"+{round((s_to - s_from) / s_from * 100)}% since acquisition", "good": True},
            {"label": "Delinquency", "value": dash_val("Accounts Receivable (delinquency)"),
             "delta": "", "good": None},
            {"label": "Cash reserves", "value": f"${reserves / 1000:.1f}K" if reserves else "",
             "delta": "", "good": None},
            {"label": "Implied value (7% cap)", "value": f"${implied / 1e6:.2f}M" if implied else "",
             "delta": f"+{round((implied / BASIS - 1) * 100)}% vs $1.46M basis" if implied else "",
             "good": True},
        ],
        "noi": {
            "labels": labels,
            "actual": actual,
            "proFormaMonthly": PRO_FORMA_MONTHLY_NOI.get(op_year, PRO_FORMA_MONTHLY_NOI[2]),
            "note": "December includes a one-time management-fee credit.",
        },
        "rentRoll": {
            "marketRent": 900,
            "avgFrom": round(s_from / len(units)),
            "avgTo": round(s_to / len(units)),
            "units": units,
        },
        "highlights": prev.get("highlights", []),
    }
    # keep the page's section order: rehab and equity sit between noi and rentRoll
    extra = {k: v for k, v in (("rehab", prev.get("rehab")), ("equity", equity)) if v}
    doc = OrderedDict(
        [(k, v) for k, v in doc.items() if k != "rentRoll" and k != "highlights"]
        + list(extra.items())
        + [("rentRoll", doc["rentRoll"]), ("highlights", doc["highlights"])]
    )

    OUT.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {OUT} — {month_keys[-1]}, {len(units)} units, "
          f"{sum(1 for u in units if u['type'] == 'turned')} turned / "
          f"{sum(1 for u in units if u['type'] == 'bump')} bumped / "
          f"{sum(1 for u in units if u['type'] == 'pending')} pending")
    print("summary, highlights, rehab and delinquency/occupancy deltas carry over or stay blank — edit them in the JSON by hand.")


if __name__ == "__main__":
    main()
