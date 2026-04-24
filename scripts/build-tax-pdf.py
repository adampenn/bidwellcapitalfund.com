"""Generate a branded PDF of the oil & gas tax benefits guide.

Matches the style of public/resources/cpa-interview-questions.pdf:
- Logo centered at top
- Title + intro
- Section headings with prose/lists
- Footer with company address and contact (on every page)
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, black
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable, ListFlowable, ListItem,
    KeepTogether, Table, TableStyle, PageBreak, Image,
)
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPDF
from reportlab.graphics.shapes import Drawing
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO_PATH = os.path.join(ROOT, "public", "logo-black.svg")
OUT_PATH = os.path.join(ROOT, "public", "resources", "oil-gas-tax-benefits.pdf")

ACCENT = HexColor("#a06b3a")
TEXT_PRIMARY = HexColor("#1a1915")
TEXT_SECONDARY = HexColor("#5c574d")
TEXT_TERTIARY = HexColor("#8a8479")
BORDER = HexColor("#dcd8d1")

# --- Styles ---
styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    "BCTitle", parent=styles["Title"],
    fontName="Helvetica", fontSize=20, leading=24,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER, spaceAfter=4,
)
subtitle_style = ParagraphStyle(
    "BCSub", parent=styles["Normal"],
    fontName="Helvetica", fontSize=10.5, leading=15,
    textColor=TEXT_SECONDARY, alignment=TA_CENTER, spaceAfter=14,
)
h2_style = ParagraphStyle(
    "BCH2", parent=styles["Heading2"],
    fontName="Helvetica", fontSize=13, leading=17,
    textColor=TEXT_PRIMARY, spaceBefore=16, spaceAfter=8,
)
h3_style = ParagraphStyle(
    "BCH3", parent=styles["Heading3"],
    fontName="Helvetica-Oblique", fontSize=10.5, leading=14,
    textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=4,
)
body_style = ParagraphStyle(
    "BCBody", parent=styles["BodyText"],
    fontName="Helvetica", fontSize=10, leading=15,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
    spaceAfter=8,
)
bullet_style = ParagraphStyle(
    "BCBullet", parent=body_style,
    leftIndent=16, bulletIndent=4, spaceAfter=4,
)
disclaimer_style = ParagraphStyle(
    "BCDisclaimer", parent=body_style,
    fontName="Helvetica-Oblique", fontSize=8.5, leading=12,
    textColor=TEXT_TERTIARY, spaceBefore=6, spaceAfter=6,
)
fine_style = ParagraphStyle(
    "BCFine", parent=body_style,
    fontSize=8.5, leading=12,
    textColor=TEXT_TERTIARY, spaceBefore=4,
)
footer_left_style = ParagraphStyle(
    "BCFootL", fontName="Helvetica", fontSize=9, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
)
footer_right_style = ParagraphStyle(
    "BCFootR", fontName="Helvetica", fontSize=9, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
)

# --- Logo ---
def load_logo(max_width=2.0 * inch):
    drawing = svg2rlg(LOGO_PATH)
    if drawing is None:
        return None
    # scale to max_width
    if drawing.width > 0:
        scale = max_width / drawing.width
        drawing.width *= scale
        drawing.height *= scale
        drawing.scale(scale, scale)
    drawing.hAlign = "CENTER"
    return drawing


# --- Page template with header+footer ---
def on_page(canvas, doc):
    canvas.saveState()
    page_w, page_h = letter

    # Header: logo + horizontal rule
    # (logo is actually on page 1 as a flowable; we only paint the rule here on later pages)
    if doc.page > 1:
        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(0.9 * inch, page_h - 0.9 * inch, page_w - 0.9 * inch, page_h - 0.9 * inch)

    # Footer
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(0.9 * inch, 1.05 * inch, page_w - 0.9 * inch, 1.05 * inch)

    canvas.setFont("Helvetica", 9)
    canvas.setFillColor(TEXT_PRIMARY)
    # Left footer
    canvas.drawString(0.9 * inch, 0.9 * inch, "Bidwell Capital")
    canvas.setFillColor(TEXT_SECONDARY)
    canvas.drawString(0.9 * inch, 0.75 * inch, "966 Lexington Ave")
    canvas.drawString(0.9 * inch, 0.6 * inch, "New York, NY 10021")
    # Right footer
    canvas.setFillColor(TEXT_PRIMARY)
    canvas.drawRightString(page_w - 0.9 * inch, 0.9 * inch, "Team@bidwellcapitalfund.com")
    canvas.setFillColor(TEXT_SECONDARY)
    canvas.drawRightString(page_w - 0.9 * inch, 0.75 * inch, "(530) 520-7331")
    # Page number center
    canvas.setFillColor(TEXT_TERTIARY)
    canvas.drawCentredString(page_w / 2, 0.45 * inch, f"{doc.page}")
    canvas.restoreState()


def build():
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    doc = SimpleDocTemplate(
        OUT_PATH,
        pagesize=letter,
        leftMargin=0.9 * inch,
        rightMargin=0.9 * inch,
        topMargin=0.85 * inch,
        bottomMargin=1.25 * inch,
        title="Tax Benefits of Oil & Gas Working Interests",
        author="Bidwell Capital",
        subject="Investor Guide",
    )

    story = []

    # Logo + top rule (page 1)
    logo = load_logo()
    if logo is not None:
        story.append(logo)
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceBefore=4, spaceAfter=10))

    # Title block
    story.append(Paragraph("Tax Benefits of Oil &amp; Gas Working Interests", title_style))
    story.append(Paragraph(
        "A plain-English walkthrough of the federal deductions that make direct "
        "working-interest investments one of the most tax-advantaged assets "
        "available to U.S. investors &mdash; and the fine print that every "
        "investor should understand before writing a check.",
        subtitle_style,
    ))

    # Disclaimer
    story.append(Paragraph(
        "This content is educational only and is not tax, legal, or investment advice. "
        "Tax outcomes depend on your individual facts and circumstances, and the rules "
        "summarized below change frequently. Consult your own CPA and attorney before "
        "acting on any of it.",
        disclaimer_style,
    ))
    story.append(Spacer(1, 6))

    # --- Stat table ---
    stat_data = [[
        Paragraph("<b>65&ndash;85%</b><br/><font size='7' color='#5c574d'>Share of drilling cost that is typically IDCs</font>", ParagraphStyle("s", fontName="Helvetica", fontSize=12, leading=15, textColor=ACCENT, alignment=TA_CENTER)),
        Paragraph("<b>100%</b><br/><font size='7' color='#5c574d'>IDCs deductible in year one for qualifying working interests</font>", ParagraphStyle("s", fontName="Helvetica", fontSize=12, leading=15, textColor=ACCENT, alignment=TA_CENTER)),
        Paragraph("<b>15%</b><br/><font size='7' color='#5c574d'>Percentage depletion on gross production revenue</font>", ParagraphStyle("s", fontName="Helvetica", fontSize=12, leading=15, textColor=ACCENT, alignment=TA_CENTER)),
        Paragraph("<b>&sect;469</b><br/><font size='7' color='#5c574d'>Working-interest exception: losses may offset active income</font>", ParagraphStyle("s", fontName="Helvetica", fontSize=12, leading=15, textColor=ACCENT, alignment=TA_CENTER)),
    ]]
    stat_table = Table(stat_data, colWidths=[1.6 * inch] * 4)
    stat_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("LINEBEFORE", (1, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#f8f7f4")),
    ]))
    story.append(stat_table)
    story.append(Spacer(1, 14))

    # --- Overview ---
    story.append(Paragraph("Overview", h2_style))
    story.append(Paragraph(
        "Congress has used the tax code to encourage domestic energy production for more than a century. "
        "The result is a set of deductions that are unusually generous &mdash; and unusually well established "
        "&mdash; for investors who take a direct working interest in an oil or gas well.", body_style))
    story.append(Paragraph(
        "When you participate in a working interest, you are not buying a share of a fund that owns a well. "
        "You are buying a fractional share of the well itself, together with the obligation to pay your "
        "proportionate share of drilling and operating costs. That distinction is what unlocks the deductions "
        "described below.", body_style))
    story.append(Paragraph("There are four primary tax benefits to understand:", body_style))
    overview_items = [
        "<b>Intangible Drilling Costs (IDCs)</b> &mdash; immediately deductible in year one.",
        "<b>Tangible Drilling Costs (TDCs)</b> &mdash; depreciated over seven years (or potentially accelerated).",
        "<b>Depletion allowance</b> &mdash; an annual deduction against production revenue for the life of the well.",
        "<b>Active-income treatment</b> &mdash; losses from a working interest are generally not passive, so they can offset W-2 wages and business income.",
    ]
    story.append(ListFlowable(
        [ListItem(Paragraph(i, bullet_style), leftIndent=16) for i in overview_items],
        bulletType="1", start="1",
    ))
    story.append(Paragraph(
        "Together, these can produce first-year deductions in the range of 70&ndash;90 percent of invested "
        "capital in a typical drilling program. What follows is a closer look at each one.", body_style))

    # --- IDCs ---
    story.append(Paragraph("Intangible Drilling Costs (IDCs)", h2_style))
    story.append(Paragraph(
        "Under <b>IRC &sect;263(c)</b> and the corresponding regulations, operators and their investors can "
        "elect to expense &mdash; rather than capitalize &mdash; the intangible costs of drilling a well. "
        "&ldquo;Intangible&rdquo; here is a term of art: it refers to costs that have no salvage value once "
        "the well is drilled. In a typical onshore well, IDCs represent roughly 65&ndash;85 percent of total well cost.",
        body_style))
    story.append(Paragraph("IDCs generally include:", body_style))
    idc_items = [
        "Labor for drilling the well",
        "Drilling fluids, mud, and chemicals",
        "Site preparation, grading, and surveying",
        "Fuel and power used during drilling",
        "Hauling and rig mobilization",
        "Bit repair and reconditioning",
    ]
    story.append(ListFlowable(
        [ListItem(Paragraph(i, bullet_style), leftIndent=16) for i in idc_items],
        bulletType="bullet",
    ))
    story.append(Paragraph(
        "The election is made on the timely filed federal return for the year the costs are incurred. Once made, "
        "it applies to all of the taxpayer&rsquo;s oil and gas operations and is essentially binding going forward. "
        "For most retail investors the election has already been made at the partnership level, and the deduction "
        "flows through on the Schedule K-1.", body_style))
    story.append(Paragraph(
        "Crucially, the IDC deduction is available <i>in the year the costs are incurred</i>, not the year the well "
        "produces. For investors writing a check late in the calendar year, that timing can matter a great deal.",
        body_style))

    story.append(Paragraph("The drilling-before-year-end rule", h3_style))
    story.append(Paragraph(
        "Under Treasury Regulation &sect;1.612-4 and related guidance, IDCs paid or incurred by year-end for a well "
        "that begins drilling by March 31 of the following year are generally deductible in the earlier year. This "
        "is the rule that drives the familiar &ldquo;December close, deduct this year&rdquo; framing in energy "
        "partnerships. The exact mechanics depend on the partnership&rsquo;s structure and accounting method, so "
        "confirm treatment with the operator and your CPA.", body_style))

    # --- Tangible ---
    story.append(Paragraph("Tangible Drilling Costs", h2_style))
    story.append(Paragraph(
        "The remaining 15&ndash;35 percent of well cost consists of equipment with salvage value. These <b>tangible "
        "drilling costs</b> are capitalized and recovered through depreciation, generally on a seven-year MACRS "
        "schedule under IRC &sect;168.", body_style))
    story.append(Paragraph("Tangible components typically include:", body_style))
    tdc_items = [
        "Casing and tubing",
        "Wellhead and Christmas tree",
        "Pumping units and surface equipment",
        "Tank batteries and separators",
        "Flow lines and gathering systems",
    ]
    story.append(ListFlowable(
        [ListItem(Paragraph(i, bullet_style), leftIndent=16) for i in tdc_items],
        bulletType="bullet",
    ))
    story.append(Paragraph(
        "Bonus depreciation provisions have historically allowed a portion of TDCs to be written off in year one. "
        "The bonus depreciation percentage has been phasing down under current law, and the applicable rate in the "
        "year of your investment depends on when the equipment is placed in service. Confirm the current percentage "
        "with your CPA &mdash; this is an area where the rules have changed repeatedly over the past several years.",
        body_style))

    # --- Depletion ---
    story.append(Paragraph("Depletion Allowance", h2_style))
    story.append(Paragraph(
        "Oil and gas are exhaustible resources. The tax code recognizes this by allowing a <b>depletion deduction</b> "
        "against production revenue, analogous to depreciation on real property. There are two methods, and an "
        "eligible taxpayer generally takes the higher of the two each year:", body_style))
    story.append(Paragraph("Cost depletion (IRC &sect;611 &ndash; &sect;613)", h3_style))
    story.append(Paragraph(
        "Allocates the investor&rsquo;s adjusted basis across estimated recoverable reserves. In practice, cost "
        "depletion is the smaller number for most producing wells and is rarely the controlling method.", body_style))
    story.append(Paragraph("Percentage depletion (IRC &sect;613A)", h3_style))
    story.append(Paragraph(
        "Allows qualifying independent producers and royalty owners to deduct <b>15 percent of gross income from "
        "the property</b> each year. Percentage depletion is not limited to basis &mdash; it can continue after the "
        "investor has fully recovered the original investment &mdash; but it is limited to 100 percent of the net "
        "income from the property and, in aggregate, 65 percent of the taxpayer&rsquo;s taxable income.", body_style))
    story.append(Paragraph(
        "Percentage depletion is available only to &ldquo;independent producers and royalty owners&rdquo; as defined "
        "in &sect;613A(c). Integrated major oil companies cannot take it. For virtually all private-placement "
        "working interest investors, percentage depletion is available so long as aggregate daily production does "
        "not exceed the statutory cap (1,000 barrels of oil equivalent per day).", body_style))

    # --- Active vs Passive ---
    story.append(Paragraph("Active vs. Passive Treatment", h2_style))
    story.append(Paragraph("This is the feature that separates oil and gas from most other tax-advantaged alternatives.", body_style))
    story.append(Paragraph(
        "Under IRC &sect;469, losses from &ldquo;passive activities&rdquo; generally cannot offset wages, "
        "self-employment income, or portfolio income. This is the rule that prevents most real estate investors "
        "from using paper losses against their W-2. Oil and gas is different.", body_style))
    story.append(Paragraph(
        "IRC &sect;469(c)(3) carves out a <b>working-interest exception</b>: a working interest in an oil or gas "
        "property is <i>not</i> a passive activity, provided the investor&rsquo;s liability for the obligations of "
        "the activity is not limited. In plain terms, if you take a direct working interest &mdash; typically "
        "structured as a general partnership interest or through an LLC that does not shield you from liability "
        "for the working interest itself &mdash; the resulting deductions can offset active income, including "
        "W-2 wages.", body_style))
    story.append(Paragraph("The three tests usually relied on are:", body_style))
    wi_items = [
        "The interest is held directly, not through a limited partnership interest or an S-corporation that limits liability.",
        "The entity does not shield the investor from liability for the obligations of the working interest.",
        "The investor&rsquo;s holding is in the form of a general partnership interest, a sole proprietorship, or an LLC taxed as a partnership that does not limit liability for the working interest.",
    ]
    story.append(ListFlowable(
        [ListItem(Paragraph(i, bullet_style), leftIndent=16) for i in wi_items],
        bulletType="bullet",
    ))
    story.append(Paragraph(
        "The exception is narrower than it looks. If the investor converts to a limited partner interest, or the "
        "entity structure changes mid-year to limit liability, the working-interest exception can be lost. The "
        "exception also does not, by itself, convert the activity from investment to trade-or-business &mdash; "
        "self-employment tax treatment is a separate question. Coordinate with your CPA.", body_style))

    # --- Small Producer ---
    story.append(Paragraph("Small Producer Exemption", h2_style))
    story.append(Paragraph(
        "The percentage depletion rules in &sect;613A are drafted around the <b>small producer exemption</b>, which "
        "limits percentage depletion to taxpayers whose average daily production does not exceed roughly 1,000 "
        "barrels of oil equivalent. Most private-placement working interest investors are well below that threshold; "
        "integrated majors are above it and therefore ineligible.", body_style))
    story.append(Paragraph(
        "There are additional related limits &mdash; the 65-percent-of-taxable-income cap, the net-income-from-property "
        "cap, and special rules for transfers and retained production payments &mdash; that your CPA will navigate "
        "in computing the actual allowable deduction each year.", body_style))

    # --- California ---
    story.append(Paragraph("California &amp; State Differences", h2_style))
    story.append(Paragraph(
        "California does not fully conform to the federal IDC rules. California generally requires IDCs to be "
        "<b>amortized over 60 months</b> rather than expensed in year one. That does not eliminate the deduction; "
        "it stretches it out. For California residents, the federal and state year-one numbers will diverge "
        "noticeably, and the state K-1 will show a different deduction than the federal K-1.", body_style))
    story.append(Paragraph(
        "Other states conform in different ways. Texas has no personal income tax and so the question is moot "
        "there. New York, Massachusetts, and several other states generally follow federal treatment on IDCs. A "
        "handful of states have idiosyncratic rules on depletion or bonus depreciation. Your CPA should be modeling "
        "both the federal and the applicable state return together.", body_style))

    # --- AMT ---
    story.append(Paragraph("Alternative Minimum Tax (AMT)", h2_style))
    story.append(Paragraph(
        "Historically, excess IDCs and excess percentage depletion were AMT preference items under IRC &sect;57, "
        "which could claw back part of the benefit at higher income levels. The Tax Cuts and Jobs Act substantially "
        "reduced the individual AMT&rsquo;s bite by raising exemption amounts and phase-out thresholds, so AMT is "
        "much less often the controlling factor than it was prior to 2018.", body_style))
    story.append(Paragraph(
        "That said, AMT exposure still needs to be modeled on a case-by-case basis. For taxpayers with very high "
        "IDC deductions relative to their regular taxable income, or for taxpayers living in high-tax states with "
        "significant SALT add-backs, AMT can still reduce the cash value of the first-year deduction.", body_style))

    # --- Recapture ---
    story.append(Paragraph("Recapture on Sale", h2_style))
    story.append(Paragraph(
        "The deductions described above reduce the investor&rsquo;s basis in the working interest. When the interest "
        "is sold, that basis reduction generally creates ordinary-income recapture under IRC &sect;1254 to the "
        "extent of prior IDC deductions and depletion in excess of basis. Gain above the recapture amount is "
        "typically capital gain.", body_style))
    story.append(Paragraph(
        "In practical terms: you are pulling deductions forward, not erasing them. The economic benefit is the "
        "time value of money and the potential rate arbitrage between ordinary income (deducted at your marginal "
        "rate today) and capital gain (recaptured at potentially lower rates on exit). For a long-term holder, "
        "that arbitrage is often substantial. For a short-term holder, it can approach zero.", body_style))

    # --- Worked Example ---
    story.append(Paragraph("Worked Example", h2_style))
    story.append(Paragraph(
        "To make this concrete, assume a $100,000 investment in a direct working-interest drilling program. The "
        "numbers below are illustrative only; actual allocations are determined by the specific well costs and "
        "partnership terms, and every deal is different.", body_style))

    cell_h = ParagraphStyle("cellh", fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=TEXT_TERTIARY, alignment=TA_LEFT)
    cell_b = ParagraphStyle("cellb", fontName="Helvetica", fontSize=10, leading=13, textColor=TEXT_PRIMARY)
    cell_s = ParagraphStyle("cells", fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=TEXT_PRIMARY)
    cell_a = ParagraphStyle("cella", fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=ACCENT)
    example_rows = [
        [Paragraph("ITEM", cell_h), Paragraph("AMOUNT", cell_h)],
        [Paragraph("Investment", cell_b), Paragraph("$100,000", cell_b)],
        [Paragraph("IDCs (assume 75% allocation)", cell_b), Paragraph("$75,000", cell_b)],
        [Paragraph("TDCs depreciable basis", cell_b), Paragraph("$25,000", cell_b)],
        [Paragraph("Year 1 IDC deduction (100%)", cell_s), Paragraph("$75,000", cell_s)],
        [Paragraph("Year 1 TDC depreciation (bonus + MACRS)", cell_s), Paragraph("~$5,000&ndash;$25,000", cell_s)],
        [Paragraph("Total Year 1 deduction (range)", cell_s), Paragraph("$80,000&ndash;$100,000", cell_s)],
        [Paragraph("Tax savings at 37% federal marginal rate (midpoint)", cell_a), Paragraph("~$33,000", cell_a)],
    ]
    ex_tbl = Table(example_rows, colWidths=[4.6 * inch, 2.0 * inch])
    ex_tbl.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, 0), 0.75, BORDER),
        ("LINEBELOW", (0, 1), (-1, -2), 0.25, HexColor("#e5e1d9")),
        ("LINEABOVE", (0, -1), (-1, -1), 0.75, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(ex_tbl)
    story.append(Paragraph(
        "The TDC depreciation figure depends entirely on the bonus depreciation percentage in effect for the year "
        "the equipment is placed in service, which has been phasing down. The tax-savings figure does not reflect "
        "state taxes, AMT, or the working-interest exception &mdash; which, if available, is what allows these "
        "deductions to offset W-2 income rather than only other passive income. Nothing in this example is a "
        "promise; it is a rough illustration of mechanics.", fine_style))

    story.append(Paragraph("Ongoing deductions", h3_style))
    story.append(Paragraph(
        "Once the well is producing, the 15 percent percentage depletion deduction applies against your allocable "
        "share of gross production revenue each year the well produces. For a well that produces meaningful revenue "
        "over a ten-year plus life, cumulative depletion can be significant and is one of the reasons working "
        "interests compare favorably on an after-tax basis to bonds or dividend-paying equities.", body_style))

    # --- How deals are structured ---
    story.append(Paragraph("How Deals Are Structured", h2_style))
    story.append(Paragraph(
        "The tax benefits above only apply if the deal is actually structured as a direct working interest. In "
        "private-placement energy funds, that typically looks like one of the following:", body_style))
    struct_items = [
        "<b>General partnership converting to limited partnership.</b> Investors enter as general partners during the drilling phase (preserving the working-interest exception and year-one IDC treatment), then convert to limited partners after completion to cap ongoing liability.",
        "<b>Multi-member LLC taxed as partnership</b> where investors&rsquo; liability is not limited for the working interest itself. Less common; requires careful drafting.",
        "<b>Direct fractional assignment</b> of a working interest to each investor, with a separate joint operating agreement. Rare for retail-sized investments but does exist.",
    ]
    story.append(ListFlowable(
        [ListItem(Paragraph(i, bullet_style), leftIndent=16) for i in struct_items],
        bulletType="bullet",
    ))
    story.append(Paragraph(
        "When you read a private-placement memorandum, the tax section and the operating agreement should describe "
        "exactly how the working-interest exception and IDC election are being preserved. If they do not, ask.", body_style))

    # --- Working with CPA ---
    story.append(Paragraph("Working With Your CPA", h2_style))
    story.append(Paragraph(
        "Almost every question that really matters here &mdash; AMT exposure, state conformity, the timing of your "
        "IDC deduction, the interaction with other passive losses, the right entity to hold the interest in &mdash; "
        "depends on facts that only your CPA can see. The worst outcome is investing for the tax benefits and then "
        "discovering at filing time that your CPA does not understand K-1 reporting from a working-interest "
        "partnership.", body_style))
    story.append(Paragraph(
        "We publish a free guide of CPA interview questions that includes a dedicated oil-and-gas section, and we "
        "are happy to connect prospective investors with CPAs who regularly handle working-interest K-1s.", body_style))

    # Final disclaimer
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceBefore=6, spaceAfter=10))
    story.append(Paragraph(
        "Bidwell Capital is not a tax advisor, accountant, or law firm, and nothing in this document is tax, legal, "
        "or investment advice. Offerings are available only to verified accredited investors under SEC Regulation D "
        "and are subject to a separate set of offering documents. All investments carry risk, including the possible "
        "loss of principal. Past performance is not indicative of future results. Tax law changes frequently; rules "
        "summarized here reflect federal law as of the date this document was prepared and may not reflect the most "
        "current guidance for your situation.", disclaimer_style))

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    build()
