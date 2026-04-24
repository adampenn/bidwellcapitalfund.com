"""Generate the branded oil & gas tax benefits PDF.

Matches the live page structure: real-fund K-1 lead, four benefits
(active first), fine-print FAQ. No em-dashes in copy.
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable, ListFlowable, ListItem,
    Table, TableStyle,
)
from svglib.svglib import svg2rlg
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO_PATH = os.path.join(ROOT, "public", "logo-black.svg")
OUT_PATH = os.path.join(ROOT, "public", "resources", "oil-gas-tax-benefits.pdf")

ACCENT = HexColor("#a06b3a")
TEXT_PRIMARY = HexColor("#1a1915")
TEXT_SECONDARY = HexColor("#5c574d")
TEXT_TERTIARY = HexColor("#8a8479")
BORDER = HexColor("#dcd8d1")

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
pull_style = ParagraphStyle(
    "BCPull", fontName="Helvetica", fontSize=11.5, leading=16,
    textColor=TEXT_PRIMARY, leftIndent=10, spaceBefore=6, spaceAfter=12,
)
tip_style = ParagraphStyle(
    "BCTip", fontName="Helvetica", fontSize=9.5, leading=14,
    textColor=TEXT_PRIMARY,
    leftIndent=10, rightIndent=10,
    borderColor=HexColor("#e8dac7"), borderWidth=0.5, borderPadding=8,
    backColor=HexColor("#f5ebdc"),
    spaceBefore=6, spaceAfter=10,
)


def load_logo(max_width=2.0 * inch):
    drawing = svg2rlg(LOGO_PATH)
    if drawing is None:
        return None
    if drawing.width > 0:
        scale = max_width / drawing.width
        drawing.width *= scale
        drawing.height *= scale
        drawing.scale(scale, scale)
    drawing.hAlign = "CENTER"
    return drawing


def on_page(canvas, doc):
    canvas.saveState()
    page_w, page_h = letter
    if doc.page > 1:
        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(0.9 * inch, page_h - 0.9 * inch, page_w - 0.9 * inch, page_h - 0.9 * inch)
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(0.9 * inch, 1.05 * inch, page_w - 0.9 * inch, 1.05 * inch)
    canvas.setFont("Helvetica", 9)
    canvas.setFillColor(TEXT_PRIMARY)
    canvas.drawString(0.9 * inch, 0.9 * inch, "Bidwell Capital")
    canvas.setFillColor(TEXT_SECONDARY)
    canvas.drawString(0.9 * inch, 0.75 * inch, "966 Lexington Ave")
    canvas.drawString(0.9 * inch, 0.6 * inch, "New York, NY 10021")
    canvas.setFillColor(TEXT_PRIMARY)
    canvas.drawRightString(page_w - 0.9 * inch, 0.9 * inch, "Team@bidwellcapitalfund.com")
    canvas.setFillColor(TEXT_SECONDARY)
    canvas.drawRightString(page_w - 0.9 * inch, 0.75 * inch, "(530) 520-7331")
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

    logo = load_logo()
    if logo is not None:
        story.append(logo)
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceBefore=4, spaceAfter=10))

    story.append(Paragraph("Tax Benefits of Oil &amp; Gas Working Interests", title_style))
    story.append(Paragraph(
        "One of the most tax-advantaged assets available to U.S. investors. "
        "Plain English up top, fine print where you can find it.",
        subtitle_style,
    ))

    story.append(Paragraph(
        "This content is educational only and is not tax, legal, or investment advice. "
        "Tax outcomes depend on your individual facts and circumstances, and the rules "
        "summarized below change frequently. Consult your own CPA and attorney before "
        "acting on any of it.",
        disclaimer_style,
    ))
    story.append(Spacer(1, 6))

    # Stat row
    stat_cell = ParagraphStyle("s", fontName="Helvetica", fontSize=12, leading=15, textColor=ACCENT, alignment=TA_CENTER)
    stat_data = [[
        Paragraph("<b>65 to 85%</b><br/><font size='7' color='#5c574d'>IDCs as a share of well cost</font>", stat_cell),
        Paragraph("<b>100%</b><br/><font size='7' color='#5c574d'>IDCs deductible in year one</font>", stat_cell),
        Paragraph("<b>15%</b><br/><font size='7' color='#5c574d'>Annual depletion on gross revenue</font>", stat_cell),
        Paragraph("<b>&sect;469</b><br/><font size='7' color='#5c574d'>Losses offset W-2 and business income</font>", stat_cell),
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

    # Real example (lead)
    story.append(Paragraph("From Our Last Fund", h2_style))
    story.append(Paragraph(
        "One investor in our most recent drilling fund committed <b>$100,000</b> and was allocated "
        "approximately <b>$99,000 in deductions</b> against their 2025 ordinary income. The relevant "
        "line from their Schedule K-1 showed $100,000 contributed, ($98,671) current-year net income "
        "(loss), and an ending capital account of $1,329.",
        body_style,
    ))
    story.append(Paragraph(
        "For an investor in the top federal bracket, that is roughly <b>$37,000 in direct tax savings</b>. "
        "<i>Before a single barrel of oil came out of the ground.</i>", pull_style,
    ))
    story.append(Paragraph(
        "Unlike most tax-advantaged real estate, these deductions offset ordinary income (W-2 wages, "
        "business income, short-term gains). They do not sit on the sidelines waiting for passive "
        "income to absorb them.",
        body_style,
    ))
    story.append(Paragraph(
        "<i>The government wants domestic energy developed. The tax code is built to reward the "
        "capital that makes it happen.</i>",
        pull_style,
    ))

    # Four benefits
    story.append(Paragraph("Benefit 1: Active-Income Treatment", h2_style))
    story.append(Paragraph(
        "This is the feature that separates oil and gas from most other tax-advantaged alternatives.",
        body_style,
    ))
    story.append(Paragraph(
        "Under IRC &sect;469, losses from passive activities generally cannot offset wages or business "
        "income. <b>IRC &sect;469(c)(3)</b> carves out a working-interest exception: a working interest "
        "in oil or gas is not a passive activity, provided your liability for the obligations of the "
        "activity is not limited. Deductions flow straight against ordinary income.",
        body_style,
    ))
    story.append(Paragraph(
        "<b>How we preserve the exception.</b> Investors in our funds enter as general partners during "
        "the drilling phase (preserving the exception and year-one IDC treatment), then convert to "
        "limited partners after completion to cap ongoing liability.",
        tip_style,
    ))

    story.append(Paragraph("Benefit 2: Intangible Drilling Costs (IDCs)", h2_style))
    story.append(Paragraph(
        "Under <b>IRC &sect;263(c)</b>, operators and their investors can elect to expense (rather than "
        "capitalize) the intangible costs of drilling a well. IDCs represent 65 to 85% of total onshore "
        "well cost.",
        body_style,
    ))
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
        "<b>December close rule.</b> IDCs paid or incurred by year-end for a well that begins drilling "
        "by March 31 of the following year are generally deductible in the earlier year "
        "(Treas. Reg. &sect;1.612-4).",
        tip_style,
    ))

    story.append(Paragraph("Benefit 3: Tangible Drilling Costs (TDCs)", h2_style))
    story.append(Paragraph(
        "The remaining 15 to 35% of well cost consists of equipment with salvage value (casing, tubing, "
        "wellhead, pumping units, tank batteries, flow lines). These tangible drilling costs are "
        "capitalized and recovered through depreciation on a seven-year MACRS schedule under "
        "IRC &sect;168.",
        body_style,
    ))
    story.append(Paragraph(
        "Bonus depreciation provisions have historically let investors write off a meaningful portion "
        "of TDCs in year one, though the bonus percentage has been phasing down under current law. "
        "Confirm the applicable rate with your CPA.",
        body_style,
    ))

    story.append(Paragraph("Benefit 4: Depletion Allowance", h2_style))
    story.append(Paragraph(
        "Oil and gas are exhaustible resources. The tax code recognizes that with a depletion "
        "deduction against production revenue. Eligible taxpayers generally take the higher of cost "
        "or percentage depletion each year.",
        body_style,
    ))
    story.append(Paragraph(
        "<b>Percentage depletion (&sect;613A).</b> 15% of gross income from the property, available to "
        "independent producers and royalty owners. Not limited to basis, so it can continue after you "
        "have recovered your original investment. Capped at 100% of net income from the property and "
        "65% of taxable income overall.",
        body_style,
    ))
    story.append(Paragraph(
        "<b>Enhanced recovery properties.</b> Qualifying enhanced-recovery and marginal-production wells "
        "can carry a higher effective rate, sometimes into the 25 to 30% range. A number of our units "
        "fall in this category.",
        tip_style,
    ))
    story.append(Paragraph(
        "<b>Small producer cap.</b> Percentage depletion is available so long as aggregate daily "
        "production does not exceed about 1,000 barrels of oil equivalent. Virtually all "
        "private-placement investors are well below it.",
        tip_style,
    ))

    # FAQ / fine print
    story.append(Paragraph("The Fine Print", h2_style))

    story.append(Paragraph("What about California?", h3_style))
    story.append(Paragraph(
        "California does not fully conform to federal IDC rules. CA generally requires IDCs to be "
        "amortized over 60 months rather than expensed in year one. That does not eliminate the "
        "deduction; it stretches it out. Federal and state K-1s will show different numbers. Texas "
        "has no personal income tax; most other states follow federal treatment.",
        body_style,
    ))

    story.append(Paragraph("What about AMT?", h3_style))
    story.append(Paragraph(
        "Historically, excess IDCs and percentage depletion were AMT preference items under "
        "IRC &sect;57. The Tax Cuts and Jobs Act raised AMT exemptions enough that AMT is rarely "
        "controlling for individuals post-2018. It still needs to be modeled case by case.",
        body_style,
    ))

    story.append(Paragraph("Is there recapture at the end?", h3_style))
    story.append(Paragraph(
        "IDC and depletion deductions reduce your basis, and on a sale, that reduction creates "
        "ordinary-income recapture under IRC &sect;1254 to the extent of prior deductions in excess "
        "of basis. <b>In practice, we do not typically sell.</b> Our model is to hold working interests "
        "and take distributions from ongoing production for the life of the well. If we never sell, "
        "there is no recapture event.",
        body_style,
    ))

    story.append(Paragraph("How do you structure the partnership?", h3_style))
    story.append(Paragraph(
        "Every fund we run uses the same structure: <b>general partnership converting to limited "
        "partnership</b>. Investors enter as GPs during drilling to preserve the working-interest "
        "exception under &sect;469(c)(3) and the year-one IDC deduction. After drilling, the entity "
        "converts to an LP to cap each investor's ongoing liability to their capital contribution.",
        body_style,
    ))

    story.append(Paragraph("What should I ask my CPA?", h3_style))
    story.append(Paragraph(
        "Almost every question that matters (AMT exposure, state conformity, timing of the IDC "
        "deduction, interaction with other passive losses, the right entity to hold the interest in) "
        "depends on facts only your CPA can see. The worst outcome is investing for the tax benefits "
        "and then discovering at filing time that your CPA does not understand K-1 reporting from a "
        "working-interest partnership. We publish a free CPA interview questions guide that includes "
        "a dedicated oil and gas section.",
        body_style,
    ))

    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceBefore=6, spaceAfter=10))
    story.append(Paragraph(
        "Bidwell Capital is not a tax advisor, accountant, or law firm, and nothing in this document "
        "is tax, legal, or investment advice. Offerings are available only to verified accredited "
        "investors under SEC Regulation D. All investments carry risk, including the possible loss of "
        "principal. Past performance is not indicative of future results. Tax law changes frequently; "
        "rules summarized here reflect federal law as of the date this document was prepared and may "
        "not reflect the most current guidance for your situation.",
        disclaimer_style,
    ))

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    build()
