"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Filter,
  MapPin,
  MessageCircle,
  PackageCheck,
  Plus,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import type { OperationSnapshot } from "@/lib/supabase/operations";

type ProjectActionItem = {
  id: string;
  title: string;
  action_number: string;
  status: string;
  priority: string;
  due_at: string | null;
};

type ActionType = "all" | "action" | "wcr" | "rfi" | "rfa" | "wir" | "issue" | "punchlist" | "document";
/** The page is reached as "Deadlines", so the buckets are deadline buckets. */
type StateFilter = "overdue" | "week" | "later" | "none" | "all";

type UnifiedItem = {
  id: string;
  source: "action" | "finding" | "register";
  type: Exclude<ActionType, "all">;
  title: string;
  reference: string;
  status: string;
  priority: string;
  /** The deadline itself. A record without one is never given a substitute date. */
  dueAt: string | null;
  meta: string;
  action?: ProjectActionItem;
};

const settledStatuses = new Set(["closed", "verified", "approved", "cancelled", "rejected", "completed"]);

const dayInMilliseconds = 24 * 60 * 60 * 1000;

/** Whole days between today and the deadline: negative is overdue, 0 is today. */
function daysUntil(dueAt: string) {
  const startOfDay = (value: Date) => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  return Math.round((startOfDay(new Date(dueAt)) - startOfDay(new Date())) / dayInMilliseconds);
}

function typeIcon(type: UnifiedItem["type"]) {
  if (type === "rfi") return <MessageCircle size={16} />;
  if (type === "rfa") return <PackageCheck size={16} />;
  if (type === "wir") return <ClipboardCheck size={16} />;
  if (type === "issue") return <AlertTriangle size={16} />;
  if (type === "punchlist") return <CheckCircle2 size={16} />;
  return <FileCheck2 size={16} />;
}

export function ProjectActionCenter({
  data,
  actions,
  projectName,
  openAction,
  createAction,
  openProjectArea,
}: {
  data: OperationSnapshot;
  actions: ProjectActionItem[];
  projectName: string;
  openAction: (actionId: string) => void;
  createAction: () => void;
  openProjectArea: (tab: "findings" | "registers" | "drawings") => void;
}) {
  const { locale, text } = useLanguage();
  const [typeFilter, setTypeFilter] = useState<ActionType>("all");
  const [stateFilter, setStateFilter] = useState<StateFilter>("overdue");
  const [search, setSearch] = useState("");

  const items = useMemo<UnifiedItem[]>(() => {
    const projectActions: UnifiedItem[] = actions.map((action) => ({
      id: action.id,
      source: "action",
      type: "action",
      title: action.title,
      reference: action.action_number,
      status: action.status,
      priority: action.priority,
      dueAt: action.due_at,
      meta: text("Assigned project action", "Toegewezen projectactie"),
      action,
    }));
    const findings: UnifiedItem[] = data.findings.map((finding) => ({
      id: finding.id,
      source: "finding",
      type: finding.finding_type === "observation" || finding.finding_type === "improvement" ? "punchlist" : "issue",
      title: finding.title,
      reference: finding.finding_number,
      status: finding.status,
      priority: finding.priority,
      // Only the deadline itself. The creation date used to stand here, which made
      // every record look like it had a deadline it never had.
      dueAt: finding.due_at,
      meta: finding.finding_type.replaceAll("_", " "),
    }));
    // Everything with a deadline belongs on a deadline page: contractor submissions as
    // well as the controlled documents CODECO issues itself.
    const registers: UnifiedItem[] = data.registerEntries
      .filter((entry) => entry.due_at || ["wcr", "rfi", "rfa", "inspection_request", "punch_list"].includes(entry.register_type))
      .map((entry) => ({
        id: entry.id,
        source: "register",
        type: entry.register_type === "inspection_request"
          ? "wir"
          : entry.register_type === "punch_list"
          ? "punchlist"
          : ["wcr", "rfi", "rfa"].includes(entry.register_type)
          ? entry.register_type as "wcr" | "rfi" | "rfa"
          : "document",
        title: entry.title,
        reference: entry.entry_number,
        status: entry.status,
        priority: String(entry.details.priority ?? "normal"),
        dueAt: entry.due_at,
        meta: entry.register_type.replaceAll("_", " "),
      }));
    return [...projectActions, ...findings, ...registers].sort((left, right) => {
      if (!left.dueAt) return right.dueAt ? 1 : 0;
      if (!right.dueAt) return -1;
      return new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
    });
  }, [actions, data.findings, data.registerEntries, text]);

  const isOpen = (item: UnifiedItem) => !settledStatuses.has(item.status);
  // A deadline only counts while the record is still open; a closed record with a date
  // in the past is not an arrear.
  const overdue = (item: UnifiedItem) => isOpen(item) && Boolean(item.dueAt) && daysUntil(item.dueAt as string) < 0;
  const withinWeek = (item: UnifiedItem) => isOpen(item) && Boolean(item.dueAt) && daysUntil(item.dueAt as string) >= 0 && daysUntil(item.dueAt as string) <= 7;
  const later = (item: UnifiedItem) => isOpen(item) && Boolean(item.dueAt) && daysUntil(item.dueAt as string) > 7;
  const withoutDeadline = (item: UnifiedItem) => isOpen(item) && !item.dueAt;
  const visibleItems = items.filter((item) => {
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    const matchesState = stateFilter === "all"
      || stateFilter === "overdue" && overdue(item)
      || stateFilter === "week" && withinWeek(item)
      || stateFilter === "later" && later(item)
      || stateFilter === "none" && withoutDeadline(item);
    const term = search.trim().toLocaleLowerCase(locale);
    const matchesSearch = !term || `${item.title} ${item.reference} ${item.type} ${item.status}`.toLocaleLowerCase(locale).includes(term);
    return matchesType && matchesState && matchesSearch;
  });

  /** The deadline in words, because "Jul 20" alone does not say that it passed. */
  const deadlineLabel = (item: UnifiedItem) => {
    if (!item.dueAt) return text("No deadline", "Geen deadline");
    const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "America/Paramaribo" }).format(new Date(item.dueAt));
    if (!isOpen(item)) return date;
    const days = daysUntil(item.dueAt);
    if (days < 0) return `${date} · ${text(`${Math.abs(days)} day(s) overdue`, `${Math.abs(days)} dag(en) te laat`)}`;
    if (days === 0) return `${date} · ${text("due today", "vandaag")}`;
    if (days === 1) return `${date} · ${text("due tomorrow", "morgen")}`;
    return `${date} · ${text(`in ${days} days`, `over ${days} dagen`)}`;
  };

  const typeTabs: Array<{ id: ActionType; label: string }> = [
    { id: "all", label: text("All work", "Alle opvolging") },
    { id: "issue", label: text("Issues / NCR", "Issues / NCR") },
    { id: "document", label: text("TI / CO / documents", "TI / CO / documenten") },
    { id: "wcr", label: "WCR" },
    { id: "rfi", label: "RFI" },
    { id: "rfa", label: "RFA" },
    { id: "wir", label: "WIR" },
    { id: "punchlist", label: "Punchlist" },
  ];

  const openItem = (item: UnifiedItem) => {
    if (item.source === "action" && item.action) openAction(item.action.id);
    else if (item.source === "finding") openProjectArea("findings");
    else openProjectArea("registers");
  };

  return (
    <section className="action-center">
      <header className="action-center-hero">
        <div><span>{projectName}</span><h1>{text("Deadlines", "Deadlines")}</h1><p>{text("Every open action, finding, NCR and formal document that carries a deadline, the closest one first.", "Elke openstaande actie, bevinding, NCR en formeel document met een deadline, de eerstvolgende bovenaan.")}</p></div>
        <button className="primary-button" type="button" onClick={createAction}><Plus size={15} /> {text("New action", "Nieuwe actie")}</button>
      </header>

      <div className="action-center-summary deadline-summary">
        {([
          ["overdue", text("Overdue", "Te laat"), items.filter(overdue).length],
          ["week", text("Within 7 days", "Binnen 7 dagen"), items.filter(withinWeek).length],
          ["later", text("Later", "Later"), items.filter(later).length],
          ["none", text("No deadline", "Geen deadline"), items.filter(withoutDeadline).length],
          ["all", text("All records", "Alle registraties"), items.length],
        ] as Array<[StateFilter, string, number]>).map(([id, label, count]) => <button className={`${stateFilter === id ? "active" : ""}${id === "overdue" && count ? " overdue" : ""}`} type="button" onClick={() => setStateFilter(id)} key={id}><strong>{count}</strong><span>{label}</span></button>)}
      </div>

      <div className="action-center-layout">
        <div className="action-center-worklist">
          <div className="action-center-toolbar">
            <div className="action-type-tabs" role="tablist" aria-label={text("Action type", "Actietype")}>
              {typeTabs.map((tab) => <button className={typeFilter === tab.id ? "active" : ""} type="button" role="tab" aria-selected={typeFilter === tab.id} onClick={() => setTypeFilter(tab.id)} key={tab.id}>{tab.label}<span>{tab.id === "all" ? items.length : items.filter((item) => item.type === tab.id).length}</span></button>)}
            </div>
            <label className="action-center-search"><Search size={15} /><span className="sr-only">{text("Search action center", "Doorzoek actiecentrum")}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text("Search reference or title", "Zoek referentie of titel")} /></label>
          </div>

          <div className="unified-action-list">
            {visibleItems.length ? visibleItems.map((item) => (
              <button className={overdue(item) ? "overdue" : ""} type="button" onClick={() => openItem(item)} key={`${item.source}:${item.id}`}>
                <span className={`unified-action-icon ${item.type}`}>{typeIcon(item.type)}</span>
                <span className="unified-action-copy"><span><b>{item.type.toUpperCase()}</b><em>{item.reference}</em></span><strong>{item.title}</strong><small className={overdue(item) ? "overdue" : ""}>{item.meta} · {deadlineLabel(item)}</small></span>
                <span className={`unified-action-priority ${item.priority}`}>{item.priority}</span>
                <span className={`document-status ${settledStatuses.has(item.status) ? "approved" : ""}`}>{item.status.replaceAll("_", " ")}</span>
                <ArrowRight size={15} />
              </button>
            )) : <div className="action-center-empty"><Filter size={24} /><div><strong>{stateFilter === "overdue" ? text("Nothing is overdue", "Niets is te laat") : text("No records match this view", "Geen registraties in deze weergave")}</strong><p>{text("Choose another deadline group or create the first assigned action.", "Kies een andere deadlinegroep of maak de eerste toegewezen actie.")}</p></div><button className="secondary-button" type="button" onClick={() => { setTypeFilter("all"); setStateFilter("all"); setSearch(""); }}>{text("Clear filters", "Wis filters")}</button></div>}
          </div>
        </div>

        <aside className="action-plan-card">
          <header><span><MapPin size={17} /></span><div><h2>{text("Location view", "Locatieweergave")}</h2><p>{data.drawingPins.length} {text("linked plan points", "gekoppelde plattegrondpunten")}</p></div></header>
          <button className="action-plan-preview" type="button" onClick={() => openProjectArea("drawings")}>
            <span className="plan-grid-lines" />
            <span className="plan-mass mass-one" />
            <span className="plan-mass mass-two" />
            <span className="plan-mass mass-three" />
            {data.drawingPins.slice(0, 4).map((pin, index) => <i className={`data-pin pin-${index + 1}`} key={pin.id}><MapPin size={15} /></i>)}
            {!data.drawingPins.length ? <span className="action-plan-empty"><MapPin size={20} /> {text("No linked points yet", "Nog geen gekoppelde punten")}</span> : null}
          </button>
          <button className="secondary-button" type="button" onClick={() => openProjectArea("drawings")}>{text("Open coordinated drawing", "Open gecoördineerde tekening")} <ArrowRight size={14} /></button>
        </aside>
      </div>
    </section>
  );
}
