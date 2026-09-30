#!/usr/bin/env python3
"""Regenerate src/data/owners/oil-fund-6.json from the OF6 Production Tracker sheet.

Reads via the `gog` CLI (must be authenticated). The sheet is the source of
truth; this script only transforms. Run monthly after the sheet is updated for
the new Rush Creek payment and the distribution is booked:

    GOG_ACCOUNT=madannep@gmail.com python3 scripts/owners/update_oil_fund_6.py

Production is shown through the production month paid by the latest
distribution (distribution month minus two, the Rush Creek payment lag), so the
page never runs ahead of what investors have been paid on.

Hand-edited fields are carried over from the existing JSON: `summary`,
`highlights`, `distributions.note`, and each well's `group` / `status`. Update
those from the new investor letter.

To archive a new monthly Kit email (the real send, not the preview):

    GOG_ACCOUNT=madannep@gmail.com python3 scripts/owners/update_oil_fund_6.py --archive <gmail message id>
"""
import base64
import html
import json
import re
import subprocess
import sys
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path

SHEET_ID = "1a5vWpLdHWhDMkYSDKbD7GkNNtA8eGP2C6KZzzkLCcOM"
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src" / "data" / "owners" / "oil-fund-6.json"
ARCHIVE = ROOT / "src" / "data" / "owners" / "oil-fund-6-updates.json"
UNDERWRITING_PRICE = 60  # $/bbl used in the fund's initial underwriting
MONTH_RE = re.compile(r"^[A-Z][a-z]{2} 20\d\d$")


def sheet(rng):
    res = subprocess.run(
        ["gog", "sheets", "get", SHEET_ID, rng, "--json"],
        capture_output=True, text=True, check=True,
    )
    return json.loads(res.stdout).get("values", [])


def num(s):
    s = str(s).replace("$", "").replace(",", "").replace("%", "").strip()
    if s in ("", "-"):
        return None
    return float(s.replace("(", "-").replace(")", ""))


def month_key(label):
    return datetime.strptime(label, "%b %Y")


def minus_months(label, n):
    d = month_key(label)
    y, m = divmod(d.year * 12 + d.month - 1 - n, 12)
    return datetime(y, m + 1, 1).strftime("%b %Y")


def short(name):
    """'Amarada East #1 (Buxton 1)' -> 'Amarada East #1' (the Chart Feed spelling)."""
    return re.sub(r"\s*\(.*\)$", "", name).strip()


def blocks_after(rows, first_header):
    """Chart Feed holds several month-by-well tables; return each as (header, rows)."""
    out, i = [], 0
    while i < len(rows):
        r = rows[i]
        if r and r[0].strip() == "Month":
            header = [c.strip() for c in r]
            body = []
            i += 1
            while i < len(rows) and rows[i] and MONTH_RE.match(rows[i][0].strip()):
                body.append(rows[i])
                i += 1
            out.append((header, body))
        else:
            i += 1
    return out


def fmt_money(v):
    return "$" + (f"{v / 1e6:.3f}".rstrip("0").rstrip(".") + "M" if v >= 1e6 else f"{v:,.0f}")


def build():
    prev = json.loads(OUT.read_text()) if OUT.exists() else {}
    prev_wells = {w["name"]: w for w in prev.get("wells", [])}

    # ---- Wells: name + WI ------------------------------------------------
    info = sheet("Well Info!A1:D20")
    wells = []
    for r in info[1:]:
        if len(r) >= 3 and r[0].strip():
            wells.append({"name": r[0].strip(), "wi": round(num(r[2]) / 100, 6)})

    # ---- Distributions: the paid-through month sets the production cutoff --
    dist_rows = sheet("Distributions!A1:P40")
    hdr_i = next(i for i, r in enumerate(dist_rows) if "Month" in [c.strip() for c in r])
    hdr = [c.strip() for c in dist_rows[hdr_i]]
    col = {h: hdr.index(h) for h in hdr if h}
    fund_size = num(next(r for r in dist_rows if "Fund Size:" in [c.strip() for c in r])[2])
    dist = []
    for r in dist_rows[hdr_i + 1:]:
        r = r + [""] * (len(hdr) - len(r))
        m = r[col["Month"]].strip()
        if not MONTH_RE.match(m):
            break
        income = num(r[col["Oil Income"]])
        if income is None:
            continue
        dist.append({"month": m, "lp": num(r[col["LP Dist (80%)"]]) or 0,
                     "per100k": num(r[col["Dist per $100K"]]) or 0})
    paid_through = minus_months(dist[-1]["month"], 2)
    cutoff = month_key(paid_through)

    # ---- Chart Feed: bbl by well, fund P&L, net income by well, cost -------
    feed = sheet("Chart Feed!A1:M120")
    tables = blocks_after(feed, "Month")
    (bbl_hdr, bbl_rows), (pl_hdr, pl_rows), (ni_hdr, ni_rows) = tables[0], tables[1], tables[2]
    cost_row = next(r for r in feed if r and r[0].strip() == "Cost")

    def keep(rows):
        return [r for r in rows if month_key(r[0].strip()) <= cutoff]

    bbl_rows, pl_rows, ni_rows = keep(bbl_rows), keep(pl_rows), keep(ni_rows)
    labels = [r[0].strip() for r in bbl_rows]

    def series(hdr_, rows, name):
        j = hdr_.index(name)
        return [(num(r[j]) if j < len(r) else None) or 0 for r in rows]

    for w in wells:
        s = short(w["name"])
        w["bbl"] = [round(v, 1) for v in series(bbl_hdr, bbl_rows, s)]
        w["cost"] = round(num(cost_row[bbl_hdr.index(s)]))
        w["netIncome"] = round(sum(series(ni_hdr, ni_rows, s)))
        w["cumBbl"] = round(sum(w["bbl"]))
        first = next((labels[i] for i, v in enumerate(w["bbl"]) if v), None)
        w["firstSales"] = first
        p = prev_wells.get(w["name"], {})
        w["group"] = p.get("group", "Producing" if first else "In progress")
        w["status"] = p.get("status", "")

    # ---- Well P&L: realized price = sum gross revenue / sum bbl -----------
    wpl = sheet("Well P&L!A1:O130")
    wpl_months = [c.strip() for c in wpl[0][1:]]
    gross = [0.0] * len(wpl_months)
    sold = [0.0] * len(wpl_months)
    for r in wpl:
        lab = r[0].strip() if r else ""
        target = gross if lab == "Gross Revenue" else sold if lab == "Oil Sold (bbl)" else None
        if target is not None:
            for j, c in enumerate(r[1:]):
                target[j] += num(c) or 0
    price_by_month = {m: round(g / s, 2) for m, g, s in zip(wpl_months, gross, sold) if s}
    price = [price_by_month.get(m) for m in labels]

    revenue = [round(num(r[1]) or 0) for r in pl_rows]
    expenses = [round(num(r[2]) or 0) for r in pl_rows]
    net = [round(num(r[3]) or 0) for r in pl_rows]

    # ---- KPIs ------------------------------------------------------------
    total = [round(sum(w["bbl"][i] for w in wells)) for i in range(len(labels))]
    producing = sum(1 for w in wells if w["group"] == "Producing")
    ready = sum(1 for w in wells if w["group"] == "Ready for production")
    paid = [d for d in dist if d["lp"]]
    cum_lp = sum(d["lp"] for d in dist)
    cum_100k = sum(d["per100k"] for d in dist)
    deployed = sum(w["cost"] for w in wells)
    last, prior = total[-1], total[-2]
    kpis = [
        {"label": "Capital raised", "value": fmt_money(fund_size),
         "delta": f"{fmt_money(deployed)} deployed across {len(wells)} wells", "good": None},
        {"label": "Wells selling oil", "value": f"{producing} of {len(wells)}",
         "delta": f"{ready} more ready for production", "good": True},
        {"label": f"Oil sold, {paid_through}", "value": f"{last:,} bbl",
         "delta": f"{(last - prior) / prior:+.0%} vs {labels[-2].split()[0]} (8/8ths)", "good": last >= prior},
        {"label": f"Realized oil price, {labels[-1].split()[0]}", "value": f"${price[-1]:.2f}",
         "delta": f"vs ${UNDERWRITING_PRICE} underwriting", "good": price[-1] >= UNDERWRITING_PRICE},
        {"label": "Distributed to LPs", "value": fmt_money(cum_lp),
         "delta": f"{len(paid)} distributions since {paid[0]['month']}", "good": None},
        {"label": "Per $100K invested", "value": f"${cum_100k:,.0f}",
         "delta": f"{cum_100k / 1000:.2f}% of capital returned", "good": None},
    ]

    doc = {
        "id": "oil-fund-6",
        "name": "Bidwell Oil Fund VI",
        "operator": "Rush Creek Resources",
        "location": "Oklahoma",
        "asOf": dist[-1]["month"],
        "paidThrough": paid_through,
        "summary": prev.get("summary", ""),
        "kpis": kpis,
        "production": {
            "labels": labels, "total": total, "price": price,
            "underwritingPrice": UNDERWRITING_PRICE,
            "note": prev.get("production", {}).get("note", ""),
        },
        "income": {"labels": labels, "revenue": revenue, "expenses": expenses, "net": net},
        "distributions": {
            "labels": [d["month"] for d in dist],
            "per100k": [round(d["per100k"], 2) for d in dist],
            "lp": [round(d["lp"], 2) for d in dist],
            "note": prev.get("distributions", {}).get("note", ""),
        },
        "wells": [{k: w[k] for k in ("name", "wi", "cost", "group", "status", "firstSales", "cumBbl", "netIncome", "bbl")}
                  for w in wells],
        "highlights": prev.get("highlights", []),
    }
    OUT.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {OUT.relative_to(ROOT)}: production through {paid_through}, distributions through {dist[-1]['month']}")


# ---- Kit email -> archive HTML ---------------------------------------------

KIT_CHROME = ("2cBDvZkj9d9xwXMPoCE9Kq", "kwGDLTschewMuexPFuTSuG")  # header logo, signature
IMG_DIR = ROOT / "public" / "oil-fund-6" / "updates"
KEEP = {"p", "strong", "b", "em", "i", "ul", "ol", "li", "a", "img", "figure", "figcaption", "br", "table", "tr", "td", "th"}
HEADINGS = {"h1": "h3", "h2": "h3", "h3": "h4", "h4": "h4"}


def real_url(href):
    """Kit click-tracking links end in the base64 of the destination."""
    m = re.match(r"https://[^/]*click\.[^/]+/[^/]+/[^/]+/([A-Za-z0-9_=-]+)$", href or "")
    if not m:
        return href
    try:
        url = base64.urlsafe_b64decode(m.group(1) + "==").decode()
    except Exception:
        return None
    # Kit pre-fills forms with the recipient's name and email; the archive links nowhere personal.
    return None if "docs.google.com/forms" in url else url


def local_image(src):
    """Copy a Kit CDN image into public/ so the archive doesn't depend on Kit."""
    parts = src.rstrip("/").split("/")
    key = parts[-2] if parts[-1] == "email" else parts[-1]
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    existing = list(IMG_DIR.glob(key + ".*"))
    if existing:
        return "/oil-fund-6/updates/" + existing[0].name
    tmp = IMG_DIR / f"{key}.download"
    ctype = subprocess.run(["curl", "-sSfL", "--retry", "3", "-o", str(tmp), "-w", "%{content_type}", src],
                           capture_output=True, text=True, check=True).stdout.split(";")[0]
    ext = {"image/png": "png", "image/gif": "gif", "image/webp": "webp"}.get(ctype, "jpg")
    tmp.rename(IMG_DIR / f"{key}.{ext}")
    if sys.platform == "darwin":  # email photos come in at full camera size
        subprocess.run(["sips", "-Z", "1000", "-s", "formatOptions", "70", str(IMG_DIR / f"{key}.{ext}")], capture_output=True)
    return f"/oil-fund-6/updates/{key}.{ext}"


class KitCleaner(HTMLParser):
    """Kit HTML body -> the archive's minimal HTML.

    Keeps everything after the greeting paragraph up to the signature; drops
    styles, layout tables, the logo, tracking pixels and unsubscribe footer.
    Headings step down one level, and tracked links point at their real target.
    """

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.on, self.done, self.skip = [], False, False, 0
        self.greeting = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if self.done:
            return
        if tag in ("style", "script", "title"):
            self.skip += 1
            return
        if tag == "img" and any(k in (a.get("src") or "") for k in KIT_CHROME[1:]) and self.on:
            self.done = True
            return
        if not self.on:
            return
        tag = HEADINGS.get(tag, tag)
        if tag in ("h3", "h4"):
            self.out.append(f"<{tag}>")
        elif tag == "img":
            src = a.get("src") or ""
            if "filekitcdn.com" in src and not any(k in src for k in KIT_CHROME):
                alt = html.escape(a.get("alt") or "", quote=True)
                self.out.append(f'<img src="{local_image(src)}" alt="{alt}" loading="lazy">')
        elif tag == "a":
            href = real_url(a.get("href"))
            self.out.append(f'<a href="{html.escape(href, quote=True)}" target="_blank" rel="noopener">' if href else "<a>")
        elif tag in KEEP and tag not in ("table", "tr", "td", "th"):
            self.out.append(f"<{tag}>")

    def handle_endtag(self, tag):
        if tag in ("style", "script", "title"):
            self.skip = max(0, self.skip - 1)
            return
        if not self.on or self.done:
            if tag == "p" and self.greeting:
                self.on, self.greeting = True, False
            return
        tag = HEADINGS.get(tag, tag)
        if tag in KEEP | {"h3", "h4"} and tag not in ("img", "br", "table", "tr", "td", "th"):
            self.out.append(f"</{tag}>")

    def handle_data(self, data):
        if self.skip or self.done:
            return
        if not self.on:
            if re.match(r"^\s*Hi .+,\s*$", data):
                self.greeting = True
            return
        if data.strip().startswith("-->"):
            self.done = True
            return
        self.out.append(html.escape(data.replace("\u200b", ""), quote=False))

    def result(self):
        h = "".join(self.out)
        h = re.sub(r"\s+", " ", h)
        h = re.sub(r"\s*(</?(?:p|ul|ol|li|h3|h4|figure|figcaption)>)\s*", r"\1", h)
        h = re.sub(r"<(p|li|h3|h4|strong|em|a|figcaption)>\s*</\1>", "", h)
        h = re.sub(r"<(p|li|h3|h4|strong|em|figcaption)>\s*</\1>", "", h)
        h = re.sub(r"(<(?:figure|p|a)[^>]*>)+$", "", h)
        return h.replace("’", "'").replace("—", ", ").strip()


def html_part(payload):
    if payload.get("mimeType") == "text/html":
        return base64.urlsafe_b64decode(payload["body"]["data"] + "==").decode("utf-8", "replace")
    for part in payload.get("parts") or []:
        found = html_part(part)
        if found:
            return found
    return None


def archive(msg_id):
    res = subprocess.run(["gog", "gmail", "get", msg_id, "--json"], capture_output=True, text=True, check=True)
    d = json.loads(res.stdout)
    if "preview" in (d.get("unsubscribe") or ""):
        sys.exit("That message is a Kit preview/test send; archive the real send.")
    sent = datetime.strptime(d["headers"]["date"][5:16], "%d %b %Y")
    # Some early subjects carried the wrong year ("February 2025"); title from the send date.
    month = re.search(r"Update\s+\S+\s+([A-Z][a-z]+)", d["headers"]["subject"]).group(1)
    title = f"Bidwell Oil Fund VI Update - {month} {sent.year}"
    cleaner = KitCleaner()
    cleaner.feed(html_part(d["message"]["payload"]))
    body = cleaner.result()
    if len(body) < 500:
        sys.exit(f"{title}: cleaned body is only {len(body)} chars; check the Kit HTML")
    data = json.loads(ARCHIVE.read_text()) if ARCHIVE.exists() else {"property": "oil-fund-6", "updates": []}
    data["updates"] = [u for u in data["updates"] if u["title"] != title]
    data["updates"].append({"title": title, "sentDate": sent.strftime("%Y-%m-%d"), "html": body})
    data["updates"].sort(key=lambda u: u["sentDate"], reverse=True)
    ARCHIVE.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"Archived {title} ({sent:%Y-%m-%d})")


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--archive":
        for mid in sys.argv[2:]:
            archive(mid)
    else:
        build()
