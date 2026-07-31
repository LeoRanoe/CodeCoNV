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

type ActionType = "all" | "action" | "wcr" | "rfi" | "rfa" | "wir" | "issue" | "punchlist";
type StateFilter = "open" | "urgent" | "verification" | "all";

type UnifiedItem = {
  id: string;
  source: "action" | "finding" | "register";
  type: Exclude<ActionType, "all">;
  title: string;
  reference: string;
  status: string;
  priority: string;
  date: string | null;
  meta: string;
  action?: ProjectActionItem;
};

const activeStatuses = new Set(["open", "assigned", "in_progress", "draft", "issued", "submitted", "pending", "reopened", "ready_for_verification"]);

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
  const [stateFilter, setStateFilter] = useState<StateFilter>("open");
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
      date: action.due_at,
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
      date: finding.due_at ?? finding.created_at,
      meta: finding.finding_type.replaceAll("_", " "),
    }));
    const registers: UnifiedItem[] = data.registerEntries
      .filter((entry) => ["wcr", "rfi", "rfa", "inspection_request", "punch_list"].includes(entry.register_type))
      .map((entry) => ({
        id: entry.id,
        source: "register",
        type: entry.register_type === "inspection_request" ? "wir" : entry.register_type === "punch_list" ? "punchlist" : entry.register_type as "wcr" | "rfi" | "rfa",
        title: entry.title,
        reference: entry.entry_number,
        status: entry.status,
        priority: String(entry.details.priority ?? "normal"),
        date: entry.due_at ?? entry.occurred_at,
        meta: entry.register_type.replaceAll("_", " "),
      }));
    return [...projectActions, ...findings, ...registers].sort((left, right) => {
      if (!left.date) return 1;
      if (!right.date) return -1;
      return new Date(left.date).getTime() - new Date(right.date).getTime();
    });
  }, [actions, data.findings, data.registerEntries, text]);

  const isOpen = (item: UnifiedItem) => activeStatuses.has(item.status);
  const isUrgent = (item: UnifiedItem) => ["high", "critical", "urgent"].includes(item.priority);
  const visibleItems = items.filter((item) => {
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    const matchesState = stateFilter === "all"
      || stateFilter === "open" && isOpen(item)
      || stateFilter === "urgent" && isOpen(item) && isUrgent(item)
      || stateFilter === "verification" && item.status === "ready_for_verification";
    const term = search.trim().toLocaleLowerCase(locale);
    const matchesSearch = !term || `${item.title} ${item.reference} ${item.type} ${item.status}`.toLocaleLowerCase(locale).includes(term);
    return matchesType && matchesState && matchesSearch;
  });

  const typeTabs: Array<{ id: ActionType; label: string }> = [
    { id: "all", label: text("All work", "Alle opvolging") },
    { id: "wcr", label: "WCR" },
    { id: "rfi", label: "RFI" },
    { id: "rfa", label: "RFA" },
    { id: "wir", label: "WIR" },
    { id: "issue", label: text("Issues / NCR", "Issues / NCR") },
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
        <div><span>{projectName}</span><h1>{text("Action center", "Actiecentrum")}</h1><p>{text("One live worklist for assigned actions, quality findings and formal requests.", "Eén actuele werklijst voor toegewezen acties, kwaliteitspunten en formele verzoeken.")}</p></div>
        <button className="primary-button" type="button" onClick={createAction}><Plus size={15} /> {text("New action", "Nieuwe actie")}</button>
      </header>

      <div className="action-center-summary">
        {([
          ["open", text("Open", "Open"), items.filter(isOpen).length],
          ["urgent", text("Urgent", "Urgent"), items.filter((item) => isOpen(item) && isUrgent(item)).length],
          ["verification", text("Awaiting verification", "Wacht op verificatie"), items.filter((item) => item.status === "ready_for_verification").length],
          ["all", text("All records", "Alle registraties"), items.length],
        ] as Array<[StateFilter, string, number]>).map(([id, label, count]) => <button className={stateFilter === id ? "active" : ""} type="button" onClick={() => setStateFilter(id)} key={id}><strong>{count}</strong><span>{label}</span></button>)}
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
              <button type="button" onClick={() => openItem(item)} key={`${item.source}:${item.id}`}>
                <span className={`unified-action-icon ${item.type}`}>{typeIcon(item.type)}</span>
                <span className="unified-action-copy"><span><b>{item.type.toUpperCase()}</b><em>{item.reference}</em></span><strong>{item.title}</strong><small>{item.meta} · {item.date ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "America/Paramaribo" }).format(new Date(item.date)) : text("No due date", "Geen einddatum")}</small></span>
                <span className={`unified-action-priority ${item.priority}`}>{item.priority}</span>
                <span className={`document-status ${["closed", "verified", "approved", "cancelled"].includes(item.status) ? "approved" : ""}`}>{item.status.replaceAll("_", " ")}</span>
                <ArrowRight size={15} />
              </button>
            )) : <div className="action-center-empty"><Filter size={24} /><div><strong>{text("No records match this view", "Geen registraties in deze weergave")}</strong><p>{text("Change a filter or create the first assigned action.", "Wijzig een filter of maak de eerste toegewezen actie.")}</p></div><button className="secondary-button" type="button" onClick={() => { setTypeFilter("all"); setStateFilter("all"); setSearch(""); }}>{text("Clear filters", "Wis filters")}</button></div>}
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
