from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


OUTPUT = Path(r"D:\CodeCoNV\output\pdf\klantvoorstel-constructiesupervisieplatform.pdf")

NAVY = colors.HexColor("#0B1F33")
NAVY_2 = colors.HexColor("#173651")
TEAL = colors.HexColor("#00A6A6")
TEAL_DARK = colors.HexColor("#087C7C")
GOLD = colors.HexColor("#F4B942")
INK = colors.HexColor("#182A3A")
MUTED = colors.HexColor("#5C6C79")
LIGHT = colors.HexColor("#F3F6F8")
PALE_TEAL = colors.HexColor("#E8F6F5")
PALE_GOLD = colors.HexColor("#FFF7E5")
BORDER = colors.HexColor("#D9E2E8")
WHITE = colors.white


pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))
pdfmetrics.registerFontFamily("Arial", normal="Arial", bold="Arial-Bold")

base = getSampleStyleSheet()
styles = {
    "cover_eyebrow": ParagraphStyle(
        "cover_eyebrow",
        parent=base["Normal"],
        fontName="Arial-Bold",
        fontSize=9,
        leading=12,
        textColor=TEAL,
        spaceAfter=8,
        uppercase=True,
    ),
    "cover_title": ParagraphStyle(
        "cover_title",
        parent=base["Title"],
        fontName="Arial-Bold",
        fontSize=31,
        leading=36,
        textColor=WHITE,
        spaceAfter=16,
    ),
    "cover_sub": ParagraphStyle(
        "cover_sub",
        parent=base["Normal"],
        fontName="Arial",
        fontSize=14,
        leading=21,
        textColor=colors.HexColor("#D9E9F2"),
        spaceAfter=24,
    ),
    "cover_small": ParagraphStyle(
        "cover_small",
        parent=base["Normal"],
        fontName="Arial",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#BCD0DD"),
    ),
    "section_no": ParagraphStyle(
        "section_no",
        parent=base["Normal"],
        fontName="Arial-Bold",
        fontSize=8,
        leading=10,
        textColor=TEAL_DARK,
        spaceAfter=5,
    ),
    "h1": ParagraphStyle(
        "h1",
        parent=base["Heading1"],
        fontName="Arial-Bold",
        fontSize=22,
        leading=27,
        textColor=NAVY,
        spaceAfter=8,
    ),
    "h2": ParagraphStyle(
        "h2",
        parent=base["Heading2"],
        fontName="Arial-Bold",
        fontSize=12,
        leading=15,
        textColor=NAVY,
        spaceAfter=5,
    ),
    "body": ParagraphStyle(
        "body",
        parent=base["BodyText"],
        fontName="Arial",
        fontSize=9.4,
        leading=14,
        textColor=INK,
        spaceAfter=7,
    ),
    "body_small": ParagraphStyle(
        "body_small",
        parent=base["BodyText"],
        fontName="Arial",
        fontSize=8.3,
        leading=12.2,
        textColor=INK,
    ),
    "muted": ParagraphStyle(
        "muted",
        parent=base["BodyText"],
        fontName="Arial",
        fontSize=8.4,
        leading=12.5,
        textColor=MUTED,
    ),
    "card_title": ParagraphStyle(
        "card_title",
        parent=base["Heading3"],
        fontName="Arial-Bold",
        fontSize=10.4,
        leading=13,
        textColor=NAVY,
        spaceAfter=4,
    ),
    "card_body": ParagraphStyle(
        "card_body",
        parent=base["BodyText"],
        fontName="Arial",
        fontSize=8.2,
        leading=11.8,
        textColor=INK,
    ),
    "nav_label": ParagraphStyle(
        "nav_label",
        parent=base["Normal"],
        fontName="Arial-Bold",
        fontSize=9,
        leading=11,
        textColor=WHITE,
        alignment=TA_CENTER,
    ),
    "number": ParagraphStyle(
        "number",
        parent=base["Normal"],
        fontName="Arial-Bold",
        fontSize=13,
        leading=16,
        alignment=TA_CENTER,
        textColor=WHITE,
    ),
    "quote": ParagraphStyle(
        "quote",
        parent=base["BodyText"],
        fontName="Arial-Bold",
        fontSize=11.2,
        leading=16,
        textColor=NAVY,
        alignment=TA_LEFT,
    ),
    "metric_value": ParagraphStyle(
        "metric_value",
        parent=base["Normal"],
        fontName="Arial-Bold",
        fontSize=17,
        leading=20,
        textColor=TEAL_DARK,
        alignment=TA_CENTER,
    ),
    "metric_label": ParagraphStyle(
        "metric_label",
        parent=base["Normal"],
        fontName="Arial",
        fontSize=7.8,
        leading=10.5,
        textColor=MUTED,
        alignment=TA_CENTER,
    ),
}


def P(text, style="body"):
    return Paragraph(text, styles[style])


def bullet(text, style="body_small"):
    paragraph_style = ParagraphStyle(
        f"bullet_{style}",
        parent=styles[style],
        leftIndent=11,
        firstLineIndent=-8,
        spaceAfter=4,
    )
    return Paragraph(f"- {text}", paragraph_style)


def section_header(number, title, intro):
    return [
        P(f"SECTIE {number}", "section_no"),
        P(title, "h1"),
        P(intro, "body"),
        Spacer(1, 4 * mm),
    ]


def card(title, body, width, background=WHITE, accent=TEAL):
    inner = Table(
        [[P(title, "card_title")], [P(body, "card_body")]],
        colWidths=[width - 12 * mm],
    )
    inner.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm),
            ]
        )
    )
    outer = Table([[inner]], colWidths=[width])
    outer.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), background),
                ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
                ("LINEBEFORE", (0, 0), (0, -1), 3, accent),
                ("LEFTPADDING", (0, 0), (-1, -1), 6 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return outer


def two_column_cards(items, width=165 * mm, gap=6 * mm):
    col = (width - gap) / 2
    rows = []
    for i in range(0, len(items), 2):
        left = card(items[i][0], items[i][1], col, *items[i][2:])
        right = card(items[i + 1][0], items[i + 1][1], col, *items[i + 1][2:]) if i + 1 < len(items) else ""
        rows.append([left, "", right])
    table = Table(rows, colWidths=[col, gap, col])
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5 * mm),
            ]
        )
    )
    return table


def callout(title, body, background=PALE_TEAL, accent=TEAL):
    content = Table(
        [[P(title, "card_title"), P(body, "body_small")]],
        colWidths=[42 * mm, 111 * mm],
    )
    content.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), background),
                ("LINEBEFORE", (0, 0), (0, -1), 4, accent),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return content


def process_step(number, title, body):
    number_box = Table([[P(str(number), "number")]], colWidths=[13 * mm], rowHeights=[13 * mm])
    number_box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), TEAL),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    text = Table([[P(title, "card_title")], [P(body, "card_body")]], colWidths=[135 * mm])
    text.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1 * mm),
            ]
        )
    )
    row = Table([[number_box, "", text]], colWidths=[13 * mm, 6 * mm, 135 * mm])
    row.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 1 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
                ("LINEBELOW", (2, 0), (2, 0), 0.5, BORDER),
            ]
        )
    )
    return row


def metric(value, label):
    block = Table([[P(value, "metric_value")], [P(label, "metric_label")]], colWidths=[48 * mm])
    block.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), WHITE),
                ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
                ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
            ]
        )
    )
    return block


def draw_cover(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setFillColor(TEAL)
    canvas.rect(0, height - 8 * mm, width, 8 * mm, fill=1, stroke=0)
    canvas.setFillColor(NAVY_2)
    canvas.circle(width - 28 * mm, height - 42 * mm, 42 * mm, fill=1, stroke=0)
    canvas.setStrokeColor(colors.HexColor("#31516B"))
    canvas.setLineWidth(0.8)
    for offset in range(0, 6):
        y = 25 * mm + offset * 8 * mm
        canvas.line(20 * mm, y, width - 20 * mm, y)
    canvas.setFillColor(colors.HexColor("#8EA6B6"))
    canvas.setFont("Arial", 8)
    canvas.drawString(20 * mm, 14 * mm, "Verkorte klantversie")
    canvas.drawRightString(width - 20 * mm, 14 * mm, "17-07-2026 | Suriname")
    canvas.restoreState()


def draw_body(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(TEAL)
    canvas.rect(0, height - 4 * mm, width, 4 * mm, fill=1, stroke=0)
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, height - 18 * mm, width - 20 * mm, height - 18 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Arial", 7.5)
    canvas.drawString(20 * mm, height - 14 * mm, "Online platform voor constructiesupervisie")
    canvas.drawRightString(width - 20 * mm, height - 14 * mm, "Verkorte klantversie")
    canvas.line(20 * mm, 15 * mm, width - 20 * mm, 15 * mm)
    canvas.drawString(20 * mm, 10 * mm, "Concept voor functionele afstemming")
    canvas.drawRightString(width - 20 * mm, 10 * mm, f"Pagina {doc.page}")
    canvas.restoreState()


def build_story():
    story = []

    # Cover
    story.extend(
        [
            Spacer(1, 38 * mm),
            P("KLANTVOORSTEL", "cover_eyebrow"),
            P("Online platform voor constructiesupervisie", "cover_title"),
            P(
                "Van dagelijkse waarneming naar een compleet, professioneel en traceerbaar projectdossier.",
                "cover_sub",
            ),
            Spacer(1, 18 * mm),
        ]
    )
    cover_cards = Table(
        [
            [P("Minder administratie", "card_title"), P("Snellere opvolging", "card_title")],
            [
                P("Eén keer registreren, automatisch hergebruiken.", "card_body"),
                P("Acties, afwijkingen en deadlines direct zichtbaar.", "card_body"),
            ],
            [P("Volledige historie", "card_title"), P("Eenvoudig aanpasbaar", "card_title")],
            [
                P("Foto's, versies, goedkeuringen en wijzigingen aantoonbaar.", "card_body"),
                P("Formulieren, checklists en rapporten door beheer instelbaar.", "card_body"),
            ],
        ],
        colWidths=[76 * mm, 76 * mm],
    )
    cover_cards.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F7FAFC")),
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#31516B")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
                ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(cover_cards)
    story.append(Spacer(1, 16 * mm))
    story.append(P("Voor een constructiesupervisiebedrijf in Suriname", "cover_small"))
    story.append(PageBreak())

    # 1. Product proposal
    story.extend(
        section_header(
            "01",
            "De kern van het voorstel",
            "De applicatie wordt het centrale online werksysteem voor de dagelijkse werkzaamheden van supervisors, projectleiding en betrokken partijen.",
        )
    )
    story.append(
        callout(
            "Eén registratie, meerdere toepassingen",
            "Een waarneming wordt één keer vastgelegd en daarna automatisch gebruikt in het dagrapport, actielijsten, kwaliteits- en veiligheidsregisters, dashboards en de projecthistorie.",
        )
    )
    story.append(Spacer(1, 6 * mm))
    benefits = [
        (
            "Minder administratietijd",
            "Supervisors registreren kort tijdens het werk. Aan het einde van de dag controleren zij vooral wat al is opgebouwd.",
            WHITE,
            TEAL,
        ),
        (
            "Betere en snellere opvolging",
            "Bevindingen, risico's, afspraken en deadlines worden direct toegewezen en blijven zichtbaar tot verificatie.",
            WHITE,
            GOLD,
        ),
        (
            "Professionele bewijsvoering",
            "Foto's, tijdstippen, locaties, reacties, versies en goedkeuringen vormen samen een controleerbare historie.",
            WHITE,
            TEAL,
        ),
        (
            "Realtime managementinzicht",
            "Projectleiding ziet voortgang, openstaande zaken en trends en kan doorklikken naar de onderliggende registraties.",
            WHITE,
            GOLD,
        ),
    ]
    story.append(two_column_cards(benefits))
    story.append(Spacer(1, 3 * mm))
    story.append(P("Uitgangspunten", "h2"))
    principles = Table(
        [
            [P("Mobiel en snel", "card_title"), P("Online en centraal", "card_title"), P("Configureerbaar", "card_title")],
            [
                P("Geschikt voor telefoon en tablet op de bouwplaats.", "card_body"),
                P("Iedereen werkt met dezelfde actuele projectinformatie.", "card_body"),
                P("Beheer past formulieren en regels aan zonder nieuwe softwareversie.", "card_body"),
            ],
        ],
        colWidths=[51 * mm, 51 * mm, 51 * mm],
    )
    principles.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(principles)
    story.append(PageBreak())

    # 2. Daily flow
    story.extend(
        section_header(
            "02",
            "Zo verloopt een werkdag",
            "De supervisor krijgt een korte, herkenbare werkstroom. Het systeem vult aan wat betrouwbaar bekend is en vraagt alleen om menselijke beoordeling waar die nodig is.",
        )
    )
    steps = [
        (
            1,
            "Project eenmalig inrichten",
            "Projectgegevens, partijen, gebouwen, zones, gebruikers, checklists, rapportindeling en goedkeuringsroute worden vooraf vastgelegd.",
        ),
        (
            2,
            "Werkdag starten",
            "De supervisor opent Vandaag. Project, datum, rapportnummer, open acties, geplande inspecties en risico's staan klaar.",
        ),
        (
            3,
            "Tijdens het werk snel registreren",
            "Foto, activiteit, inspectie, bevinding, HSE-observatie, levering, meting, vertraging of afspraak kan vanuit ieder scherm worden toegevoegd.",
        ),
        (
            4,
            "Dagrapport controleren",
            "Alle registraties van alle gebouwen worden samengevoegd. Ontbrekende informatie en tegenstrijdigheden worden vóór indiening getoond.",
        ),
        (
            5,
            "Reviewen, vrijgeven en opvolgen",
            "Na controle volgt waar nodig review en ondertekening. Open punten gaan automatisch mee naar de volgende werkdag en blijven traceerbaar.",
        ),
    ]
    for step in steps:
        story.append(process_step(*step))
    story.append(Spacer(1, 5 * mm))
    story.append(
        callout(
            "Praktisch productdoel",
            "Wanneer de werkdag volledig in de app is bijgehouden, moet de eindcontrole van het dagrapport ongeveer 5 tot 10 minuten kosten zonder kwaliteitscontrole over te slaan.",
            background=PALE_GOLD,
            accent=GOLD,
        )
    )
    story.append(Spacer(1, 8 * mm))
    story.append(P("Projectstructuur", "h2"))
    hierarchy = Table(
        [[P("MIJN PROJECTEN", "section_no"), P("GEBOUWEN", "section_no"), P("PROJECTSTART", "section_no"), P("DAGRAPPORT", "section_no")]],
        colWidths=[38 * mm, 38 * mm, 38 * mm, 39 * mm],
    )
    hierarchy.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.6, BORDER),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
            ]
        )
    )
    story.append(hierarchy)
    story.append(Spacer(1, 3 * mm))
    story.append(P("Een project kan meerdere gebouwen bevatten. Er is maximaal één dagrapport per project per dag; dit rapport combineert de registraties van alle gebouwen.", "muted"))
    story.append(PageBreak())

    # 3. Functional scope
    story.extend(
        section_header(
            "03",
            "Functionele onderdelen",
            "De oplossing dekt het volledige operationele supervisieproces. De onderdelen zijn modulair, zodat per project alleen relevante functies worden geactiveerd.",
        )
    )
    scope_cards = [
        (
            "Dagregistratie en voortgang",
            "Aanwezigheid, activiteiten, voortgang, foto's, materieel, leveringen, vertragingen, risico's en planning voor morgen.",
            WHITE,
            TEAL,
        ),
        (
            "Inspecties en kwaliteit",
            "Configureerbare checklists, metingen, bevindingen, afwijkingen, NCR's, herstelbewijs, herinspectie en verificatie.",
            WHITE,
            GOLD,
        ),
        (
            "Veiligheid en HSE",
            "Dagchecks, observaties, incidenten, near misses, directe escalatie en aantoonbare opvolging van maatregelen.",
            WHITE,
            TEAL,
        ),
        (
            "Documenten en formele communicatie",
            "Tekeningen, revisies, RFI's, submittals, site instructions, correspondentie, vergaderingen, besluiten en acties.",
            WHITE,
            GOLD,
        ),
        (
            "Rapportage en projectsturing",
            "Automatisch dagrapport, review, ondertekening, revisies, distributie, dashboards, KPI's en doorklik naar brongegevens.",
            WHITE,
            TEAL,
        ),
        (
            "Beheer en continuïteit",
            "Gebruikers, rollen, formulieren, nummering, huisstijl, notificaties, bewaartermijnen, export, back-up en herstelcontrole.",
            WHITE,
            GOLD,
        ),
    ]
    story.append(two_column_cards(scope_cards))
    story.append(Spacer(1, 4 * mm))
    story.append(
        callout(
            "Duidelijke productgrens",
            "De applicatie blijft gespecialiseerd in constructiesupervisie. Boekhouding, salaris en algemene inkoop worden niet als volledige systemen nagebouwd.",
            background=LIGHT,
            accent=NAVY_2,
        )
    )
    story.append(PageBreak())

    # 4. Screens
    story.extend(
        section_header(
            "04",
            "Schermen en bediening",
            "De gebruiker komt altijd via Mijn projecten, Gebouwen en Projectstart in de juiste context. De gekozen project- en gebouwcontext blijft zichtbaar op ieder scherm.",
        )
    )
    nav = Table(
        [[P("Vandaag", "nav_label"), P("Project", "nav_label"), P("Snel toevoegen", "nav_label"), P("Acties", "nav_label"), P("Meer", "nav_label")]],
        colWidths=[30.6 * mm] * 5,
    )
    nav.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, -1), WHITE),
                ("BOX", (0, 0), (-1, -1), 0.6, NAVY),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#31516B")),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
            ]
        )
    )
    story.append(nav)
    story.append(Spacer(1, 4 * mm))
    left_content = [
        P("Dagcockpit", "h2"),
        P("Het belangrijkste scherm geeft binnen enkele seconden antwoord op:", "body_small"),
        bullet("Wat staat vandaag gepland?"),
        bullet("Wat moet nog worden gecontroleerd?"),
        bullet("Welke kritieke problemen staan open?"),
        bullet("Welke informatie ontbreekt voor het rapport?"),
        bullet("Kan het rapport worden afgerond?"),
    ]
    right_content = [
        P("Snel toevoegen", "h2"),
        P("Een vaste actieknop opent grote, herkenbare keuzes voor:", "body_small"),
        bullet("Foto, activiteit of voortgang"),
        bullet("Inspectie of bevinding"),
        bullet("HSE-observatie of incident"),
        bullet("Actie, levering of meting"),
        bullet("Vertraging, afspraak of notitie"),
    ]
    screen_cols = Table([[left_content, right_content]], colWidths=[75 * mm, 75 * mm])
    screen_cols.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.6, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 6 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5 * mm),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(screen_cols)
    story.append(Spacer(1, 7 * mm))
    story.append(P("Belangrijkste overige schermen", "h2"))
    rows = [
        ["Werkregistratie", "Activiteiten, aanwezigheid, materieel, leveringen, testen en vertragingen"],
        ["Kwaliteit en veiligheid", "Inspecties, bevindingen, HSE, herstel en verificatie"],
        ["Samenwerking", "Acties, documenten, RFI's, vergaderingen en correspondentie"],
        ["Rapportage", "Rapportcontrole, review, ondertekening, historie en dashboard"],
        ["Beheer", "Gebruikers, rechten, sjablonen, huisstijl, back-up en export"],
    ]
    screen_table = Table(
        [[P(a, "card_title"), P(b, "body_small")] for a, b in rows],
        colWidths=[48 * mm, 105 * mm],
    )
    screen_table.setStyle(
        TableStyle(
            [
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, LIGHT]),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(screen_table)
    story.append(PageBreak())

    # 5. Automation and roles
    story.extend(
        section_header(
            "05",
            "Automatisering, rechten en controle",
            "Automatisering vermindert herhaling, maar neemt geen kritieke of juridische beslissing over. Iedere automatische handeling volgt een zichtbare bedrijfsregel.",
        )
    )
    auto_rows = [
        ["Nieuwe werkdag", "Conceptdagrapport, basisgegevens en open punten klaarzetten"],
        ["Foto of registratie", "Tijd, gebruiker, project en beschikbare locatie toevoegen"],
        ["Inspectie niet akkoord", "Conceptbevinding en mogelijke actie voorbereiden"],
        ["Deadline nadert", "Herinneren en volgens projectregel escaleren"],
        ["Dag afsluiten", "Compleetheidscontrole, samenvatting en rapportpreview opbouwen"],
        ["Rapport goedgekeurd", "Definitieve versie archiveren, distribueren en registreren"],
    ]
    auto_table = Table(
        [[P(a, "card_title"), P(b, "body_small")] for a, b in auto_rows],
        colWidths=[46 * mm, 107 * mm],
    )
    auto_table.setStyle(
        TableStyle(
            [
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [PALE_TEAL, WHITE]),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(auto_table)
    story.append(Spacer(1, 6 * mm))
    story.append(P("Menselijke controle blijft verplicht", "h2"))
    control_cols = Table(
        [
            [
                [bullet("Een incident of bevinding wordt niet automatisch gesloten."), bullet("Herstel wordt alleen door een bevoegde supervisor geverifieerd.")],
                [bullet("De app ondertekent nooit namens een persoon."), bullet("Contractuele en juridische conclusies blijven menselijke beslissingen.")],
            ]
        ],
        colWidths=[75 * mm, 75 * mm],
    )
    control_cols.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALE_GOLD),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(control_cols)
    story.append(Spacer(1, 6 * mm))
    story.append(P("Rollen in hoofdlijnen", "h2"))
    roles = [
        ("Supervisor", "Registreert, inspecteert, rapporteert en verifieert."),
        ("Lead / projectleider", "Reviewt, prioriteert, keurt goed en stuurt bij."),
        ("Aannemer", "Ziet alleen toegewezen zaken en voegt herstelbewijs toe."),
        ("Opdrachtgever / beheer", "Ontvangt goedgekeurde informatie of beheert inrichting en rechten."),
    ]
    role_table = Table(
        [[P(a, "card_title"), P(b, "card_body")] for a, b in roles],
        colWidths=[45 * mm, 108 * mm],
    )
    role_table.setStyle(
        TableStyle(
            [
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, LIGHT]),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(role_table)
    story.append(PageBreak())

    # 6. MVP and roadmap
    story.extend(
        section_header(
            "06",
            "Eerste versie en gefaseerde groei",
            "De eerste bruikbare versie ondersteunt de volledige kernflow van werkregistratie tot formeel dagrapport. Verdiepende modules volgen gecontroleerd.",
        )
    )
    mvp_left = [
        P("Kernregistratie", "h2"),
        bullet("Projecten, gebouwen, gebruikers en rollen"),
        bullet("Dagcockpit en snel toevoegen"),
        bullet("Aanwezigheid, activiteiten en voortgang"),
        bullet("Foto's, bijlagen, vertragingen en weer"),
    ]
    mvp_right = [
        P("Controle en rapportage", "h2"),
        bullet("Inspecties en configureerbare checklists"),
        bullet("Bevinding, herstel en verificatie"),
        bullet("Basis-HSE, acties en herinneringen"),
        bullet("PDF, review, ondertekening, revisie en back-up"),
    ]
    mvp_table = Table([[mvp_left, mvp_right]], colWidths=[75 * mm, 75 * mm])
    mvp_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.6, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 6 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(mvp_table)
    story.append(Spacer(1, 7 * mm))
    story.append(P("Gefaseerde roadmap", "h2"))
    roadmap = [
        ("0", "Procesvalidatie", "Werkproces, formulieren, rechten en prototype samen valideren."),
        ("1", "Kernregistratie", "Projectstart, dagcockpit, activiteiten, foto's, acties en conceptdagrapport."),
        ("2", "Kwaliteit en HSE", "Inspecties, bevindingen, herstel, veiligheid, meldingen en dashboards."),
        ("3", "Formele rapportage", "Compleetheidscontrole, PDF, review, ondertekening, revisies en distributie."),
        ("4", "Operationele verdieping", "Documenten, RFI's, leveringen, metingen, vergaderingen en managementinzicht."),
    ]
    roadmap_table = Table(
        [[P(n, "number"), P(t, "card_title"), P(b, "card_body")] for n, t, b in roadmap],
        colWidths=[12 * mm, 42 * mm, 99 * mm],
    )
    roadmap_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), TEAL),
                ("ROWBACKGROUNDS", (1, 0), (-1, -1), [WHITE, PALE_TEAL]),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5 * mm),
            ]
        )
    )
    story.append(roadmap_table)
    story.append(Spacer(1, 6 * mm))
    story.append(P("Niet in de eerste release: een volledig vrije formulierbouwer, complexe kostenadministratie, voorspellende planning, videoverwerking en AI-functies.", "muted"))
    story.append(PageBreak())

    # 7. Decisions and next steps
    story.extend(
        section_header(
            "07",
            "Besluiten, succes en volgende stappen",
            "Een aantal uitgangspunten is vastgesteld. De resterende keuzes worden samen met de klant tijdens de functionele uitwerking bevestigd.",
        )
    )
    confirmed = [
        bullet("Ontworpen voor één supervisiebedrijf met meerdere projecten, gebouwen en betrokken partijen."),
        bullet("Eerste gebruik in Suriname, in het Nederlands en met lokale datum- en tijdnotatie."),
        bullet("Maximaal één dagrapport per project per dag, samengesteld uit alle gebouwen."),
        bullet("Online werken met duidelijke opslagstatus en veilige herhaalpogingen bij verbindingsproblemen."),
        bullet("Geen AI, OCR of spraakherkenning; automatisering werkt uitsluitend met vaste regels."),
    ]
    open_items = [
        bullet("Definitieve deelregels voor opdrachtgever en aannemer."),
        bullet("Exacte dagrapport-, inspectie-, HSE- en NCR-formulieren."),
        bullet("Juridisch vereiste bewaartermijn per contract."),
        bullet("Vereist niveau van digitale ondertekening."),
        bullet("Definitieve KPI-formules en eventuele contractuele betekenis."),
    ]
    decisions = Table(
        [[P("Vastgesteld", "h2"), P("Nog te bevestigen", "h2")], [confirmed, open_items]],
        colWidths=[75 * mm, 75 * mm],
    )
    decisions.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), PALE_TEAL),
                ("BACKGROUND", (1, 0), (1, -1), PALE_GOLD),
                ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.6, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 6 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(decisions)
    story.append(Spacer(1, 4 * mm))
    story.append(P("Voorgestelde volgende stappen", "h2"))
    next_steps = [
        (1, "Procesworkshop", "Huidige en gewenste werkdag van supervisor, reviewer en aannemer vastleggen."),
        (2, "Voorbeelden verzamelen", "Bestaande rapporten, checklists, contracteisen en huisstijl beoordelen."),
        (3, "Klikbaar prototype", "Dagcockpit, snel toevoegen, inspectie, bevinding en rapportcontrole ontwerpen."),
        (4, "Praktijktest", "Een volledige werkdag met echte gebruikers simuleren en verbeteren."),
        (5, "MVP goedkeuren", "Scope, rechten, acceptatiecriteria en prioriteiten definitief vastleggen."),
    ]
    for step in next_steps:
        story.append(process_step(*step))
    story.append(Spacer(1, 1 * mm))
    story.append(
        P(
            "<b>Succesdoelen:</b> eindcontrole in 5-10 minuten, een snelle mobiele waarneming in circa 30 seconden en nul verloren of dubbele registraties.",
            "muted",
        )
    )

    return story


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=28 * mm,
        leftMargin=28 * mm,
        topMargin=25 * mm,
        bottomMargin=20 * mm,
        title="Klantvoorstel online constructiesupervisieplatform",
        author="Codex",
        subject="Verkorte functionele klantversie",
    )
    doc.build(build_story(), onFirstPage=draw_cover, onLaterPages=draw_body)
    print(OUTPUT)


if __name__ == "__main__":
    main()
