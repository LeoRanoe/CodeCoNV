"use client";

import { ArrowUpRight, Check, Copy, Paperclip, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { copyText } from "@/lib/browser/clipboard";
import { useLanguage } from "@/lib/i18n";

/**
 * What this application deliberately does not do.
 *
 * CODECO records facts and prints them. It does not summarise, weigh, compare or write
 * prose, because a supervision record that quietly invented a sentence would be worth less
 * than no record at all. The client still needs those jobs done — a compact monthly report
 * for a board, a conflict matrix across drawings, a toolbox agenda — so the answer is this
 * list: export the exact registers named under each job, attach them to a writing tool of
 * your own, and paste the prompt.
 *
 * Every prompt is written to the same three rules: work only from the attachment, name the
 * source of each statement, and mark anything uncertain rather than smoothing it over.
 */
type PromptCategory = "report" | "analysis" | "compare" | "capture";

/**
 * Where an attachment actually comes from. Naming the export in prose was not enough: the
 * reader still had to work out which screen it lived on, so every source is a button that
 * goes there. "Your own" sources have no button because they are not this app's to give.
 */
export type PromptSource =
  | "monthly-report"
  | "any-report"
  | "photos"
  | "documents"
  | "drawings"
  | "findings"
  | "ncr"
  | "inspections"
  | "hse"
  | "registers"
  | "daily-work"
  | "deadlines"
  | "own-schedule"
  | "own-transcript";

type LibraryPrompt = {
  id: string;
  category: PromptCategory;
  /** The job, in the words somebody would ask for it. */
  title: string;
  /** Why the application cannot do this itself. */
  why: string;
  /** Exactly which exports to attach before pasting the prompt. */
  attach: string;
  /** The screens those exports come from, in the order they should be collected. */
  sources: PromptSource[];
  prompt: string;
};

export function usePromptLibrary(): LibraryPrompt[] {
  const { text } = useLanguage();
  return useMemo(() => [
    {
      id: "compact-monthly",
      category: "report",
      title: text("A compact monthly report from the full month", "Een compact maandrapport uit de volle maand"),
      why: text(
        "The monthly report prints every record in the period. Deciding which of them a reader still needs is a judgement, so it is left to you.",
        "Het maandrapport drukt elke registratie in de periode af. Bepalen welke daarvan een lezer nog nodig heeft is een afweging, en die blijft bij jou.",
      ),
      attach: text("Reports → Create report → Month, downloaded as Word", "Rapporten → Rapport maken → Maand, gedownload als Word"),
      sources: ["monthly-report"],
      prompt: text(
        "Condense the attached monthly supervision report to at most two pages for a client who has not read the weekly reports. Keep every figure, date, record number and status exactly as written. Structure it as: progress this month, what slipped and why, open issues and NCRs by building, HSE, and decisions required from the client. Leave out anything that repeats. Do not add a conclusion that is not supported by a record in the attachment, and list at the end anything you left out that a reader might expect.",
        "Vat het bijgevoegde maandelijkse supervisierapport samen tot maximaal twee pagina's voor een klant die de weekrapporten niet heeft gelezen. Behoud elk cijfer, elke datum, elk registratienummer en elke status exact zoals vermeld. Structureer als: voortgang deze maand, wat is uitgelopen en waarom, open issues en NCR's per gebouw, HSE, en besluiten die de klant moet nemen. Laat alles weg wat zich herhaalt. Voeg geen conclusie toe die niet door een registratie in de bijlage wordt gedragen, en noem aan het eind wat je hebt weggelaten dat een lezer zou kunnen verwachten.",
      ),
    },
    {
      id: "executive-summary",
      category: "report",
      title: text("A management summary of one report", "Een managementsamenvatting van één rapport"),
      why: text(
        "Separating fact from risk from decision is an interpretation. The application will not make it on your behalf.",
        "Feit, risico en besluit uit elkaar halen is een interpretatie. De applicatie maakt die niet namens jou.",
      ),
      attach: text("Any downloaded CODECO report", "Elk gedownload CODECO-rapport"),
      sources: ["any-report"],
      prompt: text(
        "Create an executive project-management summary from the attached CODECO report. Separate facts, risks, decisions required, overdue actions and the next seven-day outlook. Do not invent numbers or causes; cite the report section behind every line and mark anything the report leaves open as unknown.",
        "Maak uit het bijgevoegde CODECO-rapport een managementsamenvatting. Scheid feiten, risico's, vereiste besluiten, achterstallige acties en de vooruitblik voor zeven dagen. Verzin geen cijfers of oorzaken; noem bij elke regel het rapportonderdeel en markeer als onbekend wat het rapport openlaat.",
      ),
    },
    {
      id: "steering-rewrite",
      category: "report",
      title: text("The same report, rewritten for a steering meeting", "Hetzelfde rapport, herschreven voor een stuurgroep"),
      why: text(
        "The report is written for the record, not for a room. Rewriting it for an audience is a writing job.",
        "Het rapport is geschreven voor het dossier, niet voor een zaal. Het herschrijven voor een publiek is schrijfwerk.",
      ),
      attach: text("The report for the period being discussed", "Het rapport over de periode die wordt besproken"),
      sources: ["any-report"],
      prompt: text(
        "Rewrite the attached report for a client steering meeting. Preserve all figures and statuses exactly, group actions by responsible party and finish with a decision list in which every item names who decides and by when. Do not soften a status; if something is late, say it is late.",
        "Herschrijf het bijgevoegde rapport voor een stuurgroepoverleg met de klant. Behoud alle cijfers en statussen exact, groepeer acties per verantwoordelijke en eindig met een besluitenlijst waarin bij elk punt staat wie beslist en wanneer. Verzacht geen status; als iets te laat is, schrijf dan dat het te laat is.",
      ),
    },
    {
      id: "critical-path",
      category: "analysis",
      title: text("Likely critical-path risks from the schedule", "Waarschijnlijke kritieke-padrisico's uit de planning"),
      why: text(
        "The application holds no schedule logic and no dependencies between activities, so it cannot say what a delay costs downstream.",
        "De applicatie kent geen planningslogica en geen afhankelijkheden tussen activiteiten, dus kan ze niet zeggen wat een vertraging verderop kost.",
      ),
      attach: text("Your own schedule, plus Works ongoing, Works completed, Delays and Deadlines", "Je eigen planning, plus Werkzaamheden gaande, Werkzaamheden afgerond, Vertragingen en Deadlines"),
      sources: ["own-schedule", "daily-work", "deadlines"],
      prompt: text(
        "Analyze the attached schedule together with the Works ongoing, Works completed, Delays and Deadlines exports. Identify the likely critical-path risks and prepare questions for the planner. Cite every input row you used by its record number. Do not invent dependencies that are not in the schedule; where a dependency is needed to reach a conclusion but is missing, ask for it instead of assuming it.",
        "Analyseer de bijgevoegde planning samen met de exports Werkzaamheden gaande, Werkzaamheden afgerond, Vertragingen en Deadlines. Benoem de waarschijnlijke kritieke-padrisico's en stel vragen op voor de planner. Verwijs bij elke gebruikte invoerregel naar het registratienummer. Verzin geen afhankelijkheden die niet in de planning staan; waar een afhankelijkheid nodig is voor een conclusie maar ontbreekt, vraag er dan naar in plaats van haar aan te nemen.",
      ),
    },
    {
      id: "photo-trends",
      category: "analysis",
      title: text("Repeating observations across photos, issues and NCRs", "Terugkerende observaties over foto's, issues en NCR's"),
      why: text(
        "Every record stands on its own here. Recognising that the same thing keeps happening in a different place is a pattern judgement.",
        "Elke registratie staat hier op zichzelf. Herkennen dat hetzelfde steeds op een andere plek gebeurt, is een patroonoordeel.",
      ),
      attach: text("Photo register, Issues, NCRs and inspection results over the same period", "Fotoregister, Issues, NCR's en inspectieresultaten over dezelfde periode"),
      sources: ["photos", "findings", "ncr", "inspections"],
      prompt: text(
        "Review the attached photo register, Issues, NCRs and inspection results. Cluster repeated observations by building and location, but keep Issues and NCRs separate — they are different records with different consequences. Return possible trends, the records behind each one, and what is missing before a trend could be called proven. State clearly which clusters rest on fewer than three records.",
        "Controleer het bijgevoegde fotoregister, Issues, NCR's en inspectieresultaten. Groepeer herhaalde observaties per gebouw en locatie, maar houd Issues en NCR's gescheiden — het zijn verschillende registraties met verschillende gevolgen. Geef mogelijke trends, de registraties waarop elke trend rust, en wat ontbreekt voordat een trend bewezen genoemd mag worden. Benoem expliciet welke clusters op minder dan drie registraties steunen.",
      ),
    },
    {
      id: "commercial-variance",
      category: "analysis",
      title: text("A draft commercial variance review", "Een concept commerciële afwijkingsanalyse"),
      why: text(
        "The application records quantities and change orders but takes no commercial position on them; what is exposure and what is agreed is a contract reading.",
        "De applicatie legt hoeveelheden en wijzigingsopdrachten vast maar neemt er geen commerciële positie over in; wat risico is en wat is afgesproken, is een contractlezing.",
      ),
      attach: text("BOQ, Change Orders, material deliveries and the progress report", "BOQ, wijzigingsopdrachten, materiaalleveringen en de voortgangsrapportage"),
      sources: ["registers", "any-report"],
      prompt: text(
        "Using the attached BOQ, Change Orders, material deliveries and progress report, prepare a draft commercial variance review. Separate contracted quantity, approved change, unapproved exposure and work in progress, and keep them separate in every total. Reference every figure to its source row. Where the attachments disagree, show both numbers rather than choosing one.",
        "Maak met de bijgevoegde BOQ, wijzigingsopdrachten, materiaalleveringen en voortgangsrapportage een concept commerciële afwijkingsanalyse. Scheid gecontracteerde hoeveelheid, goedgekeurde wijziging, niet-goedgekeurd risico en onderhanden werk, en houd ze in elk totaal gescheiden. Herleid elk cijfer naar de bronregel. Waar de bijlagen elkaar tegenspreken, toon beide cijfers in plaats van er één te kiezen.",
      ),
    },
    {
      id: "hse-toolbox",
      category: "analysis",
      title: text("A toolbox agenda from HSE observations", "Een toolbox-agenda uit HSE-observaties"),
      why: text(
        "Turning incidents into what a crew should be told next Monday is a safety judgement that belongs to your HSE officer.",
        "Incidenten omzetten in wat een ploeg maandag moet horen is een veiligheidsafweging die bij je HSE-functionaris hoort.",
      ),
      attach: text("HSE observations and incidents, Workforce and Works ongoing", "HSE-observaties en incidenten, Workforce en Werkzaamheden gaande"),
      sources: ["hse", "daily-work"],
      prompt: text(
        "Review the attached HSE observations, incidents, workforce and works-ongoing records for recurring weaknesses in controls. Return a draft toolbox-talk agenda and a list of questions for the HSE officer. Do not name individuals. Do not state a cause the records do not support; where the cause is unclear, write the question that would settle it.",
        "Controleer de bijgevoegde HSE-observaties, incidenten, workforce en lopende werkzaamheden op terugkerende tekortkomingen in beheersmaatregelen. Geef een concept toolbox-agenda en een lijst vragen voor de HSE-functionaris. Noem geen personen. Stel geen oorzaak die de registraties niet dragen; waar de oorzaak onduidelijk is, schrijf de vraag die het zou uitwijzen.",
      ),
    },
    {
      id: "drawing-conflicts",
      category: "compare",
      title: text("A conflict matrix across drawings and specifications", "Een conflictmatrix over tekeningen en specificaties"),
      why: text(
        "The application stores drawings and specifications but does not read what is inside them, so it cannot see that two of them disagree.",
        "De applicatie bewaart tekeningen en specificaties maar leest niet wat erin staat, dus ziet ze niet dat er twee tegenstrijdig zijn.",
      ),
      attach: text("Approved drawings, technical specifications and the current RFI/RFA log", "Goedgekeurde tekeningen, technische specificaties en het actuele RFI/RFA-log"),
      sources: ["drawings", "documents", "registers"],
      prompt: text(
        "Compare the attached approved drawings, technical specifications and the latest RFI/RFA log. Produce a conflict matrix with source filename, page or drawing reference, the conflict, the affected building and a proposed question for the designer. List only conflicts you can point at in two named sources; if you suspect one but cannot cite both sides, put it in a separate list of things to check by hand.",
        "Vergelijk de bijgevoegde goedgekeurde tekeningen, technische specificaties en het actuele RFI/RFA-log. Maak een conflictmatrix met bronbestand, pagina- of tekeningreferentie, het conflict, het betrokken gebouw en een voorgestelde vraag aan de ontwerper. Noem alleen conflicten die je in twee benoemde bronnen kunt aanwijzen; vermoed je er een zonder beide kanten te kunnen citeren, zet die dan in een aparte lijst om met de hand na te lopen.",
      ),
    },
    {
      id: "report-risk-review",
      category: "compare",
      title: text("A second reading of a report for risks", "Een tweede lezing van een rapport op risico's"),
      why: text(
        "A report is checked by the person who wrote it. A second, disinterested reading is something the application cannot give you.",
        "Een rapport wordt gecontroleerd door wie het schreef. Een tweede, belangeloze lezing kan de applicatie je niet geven.",
      ),
      attach: text("The report you are about to send", "Het rapport dat je op het punt staat te versturen"),
      sources: ["any-report"],
      prompt: text(
        "Review this supervision report for schedule, quality, HSE and commercial risks. For every conclusion, cite the exact report section and clearly mark uncertainty. Also list what the report does not say that a reader would reasonably expect to find, and any statement that reads as an opinion rather than a record.",
        "Controleer dit supervisierapport op planning-, kwaliteit-, HSE- en commerciële risico's. Noem bij elke conclusie het exacte rapportonderdeel en markeer onzekerheid duidelijk. Noem ook wat het rapport níét zegt maar een lezer redelijkerwijs zou verwachten, en elke passage die als mening leest in plaats van als registratie.",
      ),
    },
    {
      id: "transcript-agreements",
      category: "capture",
      title: text("Agreements made, out of a meeting recording", "Gemaakte afspraken, uit een vergaderopname"),
      why: text(
        "The application records an agreement once somebody types it. It does not listen to meetings.",
        "De applicatie legt een afspraak vast zodra iemand haar intypt. Ze luistert niet mee in vergaderingen.",
      ),
      attach: text("Your own transcript of the meeting", "Je eigen transcript van de vergadering"),
      sources: ["own-transcript", "registers"],
      prompt: text(
        "Convert the attached meeting transcript into draft Agreements made. For each item provide the decision, the responsible party, the due date, the source timestamp and your confidence. Mark unclear owners or dates as open questions rather than guessing them, and keep anything that was discussed but not decided in a separate list.",
        "Zet het bijgevoegde vergadertranscript om in concept Gemaakte afspraken. Geef per punt het besluit, de verantwoordelijke partij, de deadline, het brontijdstip en je zekerheid. Markeer onduidelijke eigenaars of data als open vragen in plaats van ze te raden, en houd wat wel is besproken maar niet besloten in een aparte lijst.",
      ),
    },
  ], [text]);
}

const categoryOrder: PromptCategory[] = ["report", "analysis", "compare", "capture"];

/** Where each source lives, so the card can hand the reader straight to it. */
export type PromptShortcutTargets = {
  /** The report builder, set to a whole month, which is the export most prompts want. */
  openMonthlyReport: () => void;
  /** The report builder as it stands, for a period the reader picks. */
  openReportBuilder: () => void;
  /** One workspace module by its own tab. */
  openModule: (tab: "files" | "documents" | "drawings" | "findings" | "ncr" | "inspections" | "hse" | "registers" | "daily") => void;
  /** The deadline view of the action centre. */
  openDeadlines: () => void;
};

export function PromptLibrary({ shortcuts }: { shortcuts: PromptShortcutTargets }) {
  const { text } = useLanguage();
  const prompts = usePromptLibrary();
  const [term, setTerm] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [copyError, setCopyError] = useState("");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  /**
   * Two of the sources are not this application's to hand over — a schedule and a meeting
   * transcript come from elsewhere — so those are named without a button rather than
   * given one that goes nowhere.
   */
  const sourceRoutes: Record<PromptSource, { label: string; go?: () => void }> = {
    "monthly-report": { label: text("Report → Month", "Rapport → Maand"), go: shortcuts.openMonthlyReport },
    "any-report": { label: text("Report builder", "Rapport maken"), go: shortcuts.openReportBuilder },
    photos: { label: text("Photos", "Foto's"), go: () => shortcuts.openModule("files") },
    documents: { label: "Project Docs", go: () => shortcuts.openModule("documents") },
    drawings: { label: text("Drawings", "Tekeningen"), go: () => shortcuts.openModule("drawings") },
    findings: { label: "Issues", go: () => shortcuts.openModule("findings") },
    ncr: { label: "NCR", go: () => shortcuts.openModule("ncr") },
    inspections: { label: text("Inspections", "Inspecties"), go: () => shortcuts.openModule("inspections") },
    hse: { label: "HSE", go: () => shortcuts.openModule("hse") },
    registers: { label: text("Registers", "Registers"), go: () => shortcuts.openModule("registers") },
    "daily-work": { label: text("Daily work", "Dagwerk"), go: () => shortcuts.openModule("daily") },
    deadlines: { label: "Deadlines", go: shortcuts.openDeadlines },
    "own-schedule": { label: text("Your own schedule", "Je eigen planning") },
    "own-transcript": { label: text("Your own transcript", "Je eigen transcript") },
  };

  const categoryLabels: Record<PromptCategory, string> = {
    report: text("Writing a report differently", "Een rapport anders opschrijven"),
    analysis: text("Weighing records against each other", "Registraties tegen elkaar wegen"),
    compare: text("Reading what is inside documents", "Lezen wat er in documenten staat"),
    capture: text("Turning a conversation into records", "Een gesprek omzetten in registraties"),
  };

  const needle = term.trim().toLowerCase();
  const visible = needle
    ? prompts.filter((item) => [item.title, item.why, item.attach, item.prompt].some((field) => field.toLowerCase().includes(needle)))
    : prompts;

  const copy = async (item: LibraryPrompt) => {
    setCopyError("");
    setCopiedId("");
    try {
      await copyText(item.prompt);
      setCopiedId(item.id);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedId(""), 2400);
    } catch {
      setCopyError(text("Copy failed. Open the prompt and copy its text manually.", "Kopiëren mislukt. Open de prompt en kopieer de tekst handmatig."));
    }
  };

  return (
    <section className="prompt-library">
      {copyError ? <p className="field-error" role="alert">{copyError}</p> : null}
      <header className="prompt-library-intro">
        <div>
          <p className="eyebrow">{text("Outside this application", "Buiten deze applicatie")}</p>
          <h2>{text("What CODECO deliberately leaves to you", "Wat CODECO bewust aan jou laat")}</h2>
          <p>
            {text(
              "This application records facts and prints them. It does not summarise, weigh or write prose, because a supervision record that quietly invented a sentence would be worth less than no record at all. For the jobs that need exactly that, export the registers named below, attach them to a writing tool of your own and paste the prompt.",
              "Deze applicatie legt feiten vast en drukt ze af. Ze vat niet samen, weegt niet af en schrijft geen proza, want een supervisieregistratie die stilletjes een zin verzint is minder waard dan geen registratie. Voor de klussen die juist dat vragen: exporteer de hieronder genoemde registers, hang ze aan een schrijfhulpmiddel naar keuze en plak de prompt.",
            )}
          </p>
        </div>
      </header>

      <label className="prompt-library-search">
        <Search size={15} />
        <span className="sr-only">{text("Search the prompt library", "Doorzoek de promptbibliotheek")}</span>
        <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder={text("Search by job, register or word", "Zoek op klus, register of woord")} />
      </label>

      {categoryOrder.map((category) => {
        const items = visible.filter((item) => item.category === category);
        if (!items.length) return null;
        return (
          <section className="prompt-library-group" key={category}>
            <h3>{categoryLabels[category]}</h3>
            <div className="prompt-library-list">
              {items.map((item) => (
                <article className="prompt-card" key={item.id}>
                  <header>
                    <strong>{item.title}</strong>
                    <button type="button" onClick={() => void copy(item)}>
                      {copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}
                      {copiedId === item.id ? text("Copied", "Gekopieerd") : text("Copy prompt", "Kopieer prompt")}
                    </button>
                  </header>
                  <p className="prompt-card-why">{item.why}</p>
                  <p className="prompt-card-attach"><Paperclip size={13} /> <span><strong>{text("Attach", "Bijvoegen")}:</strong> {item.attach}</span></p>
                  {/* The same sources again, as the way to go and get them. */}
                  <div className="prompt-card-sources">
                    {item.sources.map((source) => {
                      const route = sourceRoutes[source];
                      return route.go ? (
                        <button className="prompt-source" type="button" onClick={route.go} key={source}>
                          {route.label} <ArrowUpRight size={12} />
                        </button>
                      ) : (
                        <span className="prompt-source own" key={source}>{route.label}</span>
                      );
                    })}
                  </div>
                  <details>
                    <summary>{text("Read the prompt", "Lees de prompt")}</summary>
                    <p className="prompt-card-text">{item.prompt}</p>
                  </details>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      {!visible.length ? <p className="backup-empty">{text("No prompt matches that.", "Geen prompt komt hiermee overeen.")}</p> : null}
    </section>
  );
}
