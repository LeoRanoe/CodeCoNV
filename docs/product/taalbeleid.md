# Taalbeleid

Besloten op 2026-10-29 (QA-ronde, bevindingen L9 en L26). Dit beleid vervangt de open vraag "volledig Nederlands of niet" in `docs/operations/qa-fix-prompt.md`.

## Regel

1. **Alles wat de app zelf schrijft volgt de taalkeuze.** Knoppen, labels, hints, meldingen, foutteksten, antwoordkeuzes (bijvoorbeeld Geen / Mogelijk / Bevestigd) en de voorvoegsels die de app aan een record geeft ("Afgekeurd controlepunt: …").
2. **De namen van modules en formulieren van CODECO's eigen papieren formulieren blijven zoals het formulier ze schrijft**, ook in de Nederlandse interface: Workforce, Issues, Punchlist, Project Docs, Change order (CO), Non-conformance report (NCR), WCR/RFA/WIR, Health · Safety · Environmental, Lessons Learned (LL), Agreements Made, Project Delay Report (PDR). De klant schrijft ze zo in al haar feedback (`docs/product/klantfeedback-*.md`) en een test (`calls each form what the client's own paper calls it`) bewaakt het. Een vertaling zou de naam op het scherm laten afwijken van de naam op het formulier dat wordt ondertekend.
3. **Wat een gebruiker of de klant als inhoud heeft geschreven blijft zoals het is geschreven.** Dat zijn de checklists van de klant (de bibliotheek `LIB-1xx` is haar Engelse referentieformulier), NCR-categorieën, titels en omschrijvingen van records. Een ondertekende inspectie bewaart de tekst die is getekend; die verandert niet als iemand de taal omzet.
4. **Vaste afkortingen** blijven (NCR, RFI, TI, CO, HSE, PDR, WIR, PDF, BOQ).

## Wat dit betekent voor de bevindingen

- L9: de Engelse labels van het NCR-formulier die niet op het papieren formulier staan zijn vertaald; de modulenamen volgen regel 2. De antwoordkeuzes van het TI-formulier (discipline, planning- en kostenimpact) volgen nu de taalkeuze.
- L26: de Engelse checklistteksten en NCR-categorieën zijn inhoud van de klant (regel 3) en worden niet vertaald. Wil CODECO Nederlandse checklists, dan is dat nieuwe inhoud met een eigen versie, geen vertaling van ondertekende records.

Een wijziging van dit beleid begint bij de klant, niet in de code.
