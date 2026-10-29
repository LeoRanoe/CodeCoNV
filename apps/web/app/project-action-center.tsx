"use client";

import { SectionNav } from "@/app/section-nav";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Filter,
  MapPin,
  MessageCircle,
  PackageCheck,
  Plus,
  Search,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useProjectPermissions } from "@/lib/permissions/project-permissions";
import { useLanguage } from "@/lib/i18n";
import {
  compareActionItems,
  daysUntilOnSite,
  isEscalatedItem,
  isOpenItem,
  isOverdueItem,
  isSettledStatus,
  nextStepFor,
} from "@/lib/actions/action-center.mjs";
import type { OperationSnapshot } from "@/lib/supabase/operations";
import type { ProjectParty } from "@/lib/supabase/data";
import { statusText, typeText, priorityText } from "@/lib/status-labels";

type ProjectActionItem = {
  id: string;
  title: string;
  action_number: string;
  status: string;
  priority: string;
  due_at: string | null;
  owner_user_id?: string | null;
  owner_party_id?: string | null;
};

type ActionType = "all" | "action" | "wcr" | "rfi" | "rfa" | "wir" | "issue" | "punchlist" | "document";
/**
 * The action centre is one page that answers one question: what is expected of me, and what
 * has to happen next with it. It has three ways of looking at the same worklist — the work
 * that is mine, all work on the project, and the work that has to be met by a date. The
 * client asked for the action centre; the deadline tile of the workspace opens the same page
 * on its deadline view.
 */
export type ActionCenterView = "mine" | "work" | "deadlines";
type WorkFilter = "open" | "escalated" | "verification" | "all";
type DeadlineFilter = "overdue" | "week" | "later" | "none" | "all";
/** Which record a row opens, so tapping it never lands on a list the record is not in. */
export type ActionCenterTarget = "findings" | "ncr" | "registers" | "drawings";

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
  /** The person this record is waiting on, when the record knows one. */
  ownerUserId: string | null;
  /** Who has to act, in words: a CODECO colleague or an external party. */
  ownerLabel: string;
  /** Marked for escalation on the client's own issue form. */
  escalationRequired: boolean;
  /** For a finding: the finding type, so an NCR opens in the NCR module. */
  recordKind?: string;
  action?: ProjectActionItem;
};

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
  initialView = "work",
  currentUserId,
  parties,
  resolveUserName,
  openAction,
  createAction,
  openProjectArea,
}: {
  data: OperationSnapshot;
  actions: ProjectActionItem[];
  projectName: string;
  /** "deadlines" when the workspace deadline tile opened this page. */
  initialView?: ActionCenterView;
  /** Who is looking, so the page can start with the work that is theirs. */
  currentUserId: string;
  parties: ProjectParty[];
  resolveUserName: (userId: string | null) => string;
  openAction: (actionId: string) => void;
  createAction: () => void;
  /** Opens the module with the record itself in front of the user, not just its list. */
  openProjectArea: (tab: ActionCenterTarget, recordId?: string) => void;
}) {
  const { locale, text } = useLanguage();
  const permissions = useProjectPermissions();
  // Saving an action assigns it to a company employee, which the database allows only with
  // actions.manage. A button for someone who only holds actions.create always ended in a refusal.
  const canCreateAction = permissions.can("actions.create") && permissions.can("actions.manage");
  const [typeFilter, setTypeFilter] = useState<ActionType>("all");
  const [workFilter, setWorkFilter] = useState<WorkFilter>("open");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>("overdue");
  const [search, setSearch] = useState("");

  const partyName = (partyId: string | null | undefined) => parties.find((party) => party.id === partyId)?.name ?? "";

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
      ownerUserId: action.owner_user_id ?? null,
      ownerLabel: resolveUserName(action.owner_user_id ?? null) || partyName(action.owner_party_id),
      escalationRequired: false,
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
      meta: typeText(finding.finding_type, text),
      ownerUserId: finding.assigned_user_id ?? null,
      ownerLabel: resolveUserName(finding.assigned_user_id) || partyName(finding.responsible_party_id),
      escalationRequired: Boolean(finding.issue_management?.escalation_required),
      recordKind: finding.finding_type,
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
        meta: typeText(entry.register_type, text),
        // A controlled document is addressed to a party, never to a single colleague.
        ownerUserId: null,
        ownerLabel: String(entry.details.requested_to ?? entry.details.contractor ?? ""),
        escalationRequired: false,
      }));
    return [...projectActions, ...findings, ...registers].sort((left, right) => compareActionItems(left, right));
    // partyName and resolveUserName are derived from parties, which is in the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, data.findings, data.registerEntries, parties, resolveUserName, text]);

  const mine = useMemo(() => items.filter((item) => Boolean(currentUserId) && item.ownerUserId === currentUserId), [currentUserId, items]);
  // Somebody who has work of their own starts on it: that is the question the page exists
  // to answer. Somebody without assigned work would only see an empty page, so they start
  // on the whole project instead.
  const [view, setView] = useState<ActionCenterView>(() => initialView === "work" && mine.some(isOpenItem) ? "mine" : initialView);

  const isOpen = (item: UnifiedItem) => isOpenItem(item);
  const isEscalated = (item: UnifiedItem) => isEscalatedItem(item);
  // A deadline only counts while the record is still open; a closed record with a date
  // in the past is not an arrear.
  const overdue = (item: UnifiedItem) => isOverdueItem(item);
  const withinWeek = (item: UnifiedItem) => isOpen(item) && Boolean(item.dueAt) && daysUntilOnSite(item.dueAt as string) >= 0 && daysUntilOnSite(item.dueAt as string) <= 7;
  const later = (item: UnifiedItem) => isOpen(item) && Boolean(item.dueAt) && daysUntilOnSite(item.dueAt as string) > 7;
  const withoutDeadline = (item: UnifiedItem) => isOpen(item) && !item.dueAt;
  const unassigned = (item: UnifiedItem) => isOpen(item) && !item.ownerUserId && !item.ownerLabel;
  const matchesWorkFilter = (item: UnifiedItem) => workFilter === "all"
    || workFilter === "open" && isOpen(item)
    || workFilter === "escalated" && isEscalated(item)
    || workFilter === "verification" && item.status === "ready_for_verification";
  const matchesDeadlineFilter = (item: UnifiedItem) => deadlineFilter === "all"
    || deadlineFilter === "overdue" && overdue(item)
    || deadlineFilter === "week" && withinWeek(item)
    || deadlineFilter === "later" && later(item)
    || deadlineFilter === "none" && withoutDeadline(item);
  const scopedItems = view === "mine" ? mine : items;
  // A number on a tile or a tab is what the list shows after pressing it: tiles count within
  // the chosen type, tabs within the chosen state.
  const typeScopedItems = scopedItems.filter((item) => typeFilter === "all" || item.type === typeFilter);
  const stateScopedItems = scopedItems.filter((item) => view === "deadlines" ? matchesDeadlineFilter(item) : matchesWorkFilter(item));
  const visibleItems = scopedItems.filter((item) => {
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    const matchesState = view === "deadlines" ? matchesDeadlineFilter(item) : matchesWorkFilter(item);
    const term = search.trim().toLocaleLowerCase(locale);
    const matchesSearch = !term || `${item.title} ${item.reference} ${item.type} ${item.status} ${item.ownerLabel}`.toLocaleLowerCase(locale).includes(term);
    return matchesType && matchesState && matchesSearch;
  });

  /** The deadline in words, because "Jul 20" alone does not say that it passed. */
  const deadlineLabel = (item: UnifiedItem) => {
    if (!item.dueAt) return text("No deadline", "Geen deadline");
    const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "America/Paramaribo" }).format(new Date(item.dueAt));
    if (!isOpen(item)) return date;
    const days = daysUntilOnSite(item.dueAt);
    if (days < 0) return `${date} · ${text(`${Math.abs(days)} day(s) overdue`, `${Math.abs(days)} dag(en) te laat`)}`;
    if (days === 0) return `${date} · ${text("due today", "vandaag")}`;
    if (days === 1) return `${date} · ${text("due tomorrow", "morgen")}`;
    return `${date} · ${text(`in ${days} days`, `over ${days} dagen`)}`;
  };

  /**
   * The one instruction that belongs on this row. A worklist that shows a status but never
   * says what to do with it is exactly what the client could not read.
   */
  const nextStepLabel = (item: UnifiedItem) => {
    const step = nextStepFor(item);
    if (step === "done") return text("Closed · nothing to do", "Afgerond · niets te doen");
    if (step === "finish") return text("Finish and submit this record", "Maak deze registratie af en dien hem in");
    if (step === "verify") return text("Check the work on site and close it out", "Controleer het werk op locatie en sluit af");
    if (step === "decide") return text("Record the decision on this submission", "Leg het besluit over deze indiening vast");
    if (step === "assign") return text("Assign who has to do this", "Wijs toe wie dit moet doen");
    if (step === "progress") return text("Add evidence and report it ready", "Voeg bewijs toe en meld het gereed");
    return text("Start the follow-up", "Start de opvolging");
  };

  const ownerLabel = (item: UnifiedItem) => {
    if (currentUserId && item.ownerUserId === currentUserId) return text("Yours", "Van jou");
    return item.ownerLabel || text("Nobody yet", "Nog niemand");
  };

  const typeTabs: Array<{ id: ActionType; label: string }> = [
    { id: "all", label: text("All work", "Alle opvolging") },
    { id: "action", label: text("Actions", "Acties") },
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
    // An NCR lives in its own module; sending the user to Issues would be a dead end. The
    // record itself is opened, not the list it happens to be in.
    else if (item.source === "finding") openProjectArea(item.recordKind === "ncr" ? "ncr" : "findings", item.id);
    else openProjectArea("registers", item.id);
  };

  const escalations = scopedItems.filter(isEscalated).slice(0, 4);
  return (
    <section className="action-center">
      <header className="action-center-hero">
        <div><h1>{text("Action center", "Actiecentrum")}</h1><p>{projectName}</p></div>
        {canCreateAction ? <button className="ui-button ui-button--primary ui-button--md" type="button" onClick={createAction}><Plus size={15} /> {text("New action", "Nieuwe actie")}</button> : null}
      </header>

      {/* One page, three ways of looking at the same worklist. */}
      <SectionNav
        className="action-center-views"
        label={text("Action center view", "Weergave actiecentrum")}
        items={[
          { id: "mine", label: text("My work", "Mijn werk"), count: mine.filter(isOpen).length, icon: <UserRound size={18} />, selected: view === "mine", onSelect: () => setView("mine") },
          { id: "work", label: text("All project work", "Al het projectwerk"), icon: <ClipboardCheck size={18} />, selected: view === "work", onSelect: () => setView("work") },
          { id: "deadlines", label: text("Deadlines", "Deadlines"), count: items.filter(overdue).length, icon: <CalendarClock size={18} />, selected: view === "deadlines", onSelect: () => setView("deadlines") },
        ]}
      />

      {view === "deadlines" ? (
        <div className="action-center-summary deadline-summary">
          {([
            ["overdue", text("Overdue", "Te laat"), typeScopedItems.filter(overdue).length],
            ["week", text("Within 7 days", "Binnen 7 dagen"), typeScopedItems.filter(withinWeek).length],
            ["later", text("Later", "Later"), typeScopedItems.filter(later).length],
            ["none", text("No deadline", "Geen deadline"), typeScopedItems.filter(withoutDeadline).length],
            ["all", text("All records", "Alle registraties"), typeScopedItems.length],
          ] as Array<[DeadlineFilter, string, number]>).map(([id, label, count]) => <button className={`${deadlineFilter === id ? "active" : ""}${id === "overdue" && count ? " overdue" : ""}`} type="button" onClick={() => setDeadlineFilter(id)} key={id}><strong>{count}</strong><span>{label}</span></button>)}
        </div>
      ) : (
        <div className="action-center-summary">
          {([
            ["open", text("Still open", "Nog open"), typeScopedItems.filter(isOpen).length],
            ["escalated", text("Escalations · late or urgent", "Escalaties · te laat of urgent"), typeScopedItems.filter(isEscalated).length],
            ["verification", text("Waiting for verification", "Wacht op verificatie"), typeScopedItems.filter((item) => item.status === "ready_for_verification").length],
            ["all", text("All records", "Alle registraties"), typeScopedItems.length],
          ] as Array<[WorkFilter, string, number]>).map(([id, label, count]) => <button className={`${workFilter === id ? "active" : ""}${id === "escalated" && count ? " overdue" : ""}`} type="button" onClick={() => setWorkFilter(id)} key={id}><strong>{count}</strong><span>{label}</span></button>)}
        </div>
      )}

      <div className="action-center-layout">
        <div className="action-center-worklist">
          <div className="action-center-toolbar">
            <SectionNav
              className="action-type-tabs"
              label={text("Action type", "Actietype")}
              items={typeTabs.map((tab) => ({ id: tab.id, label: tab.label, count: tab.id === "all" ? stateScopedItems.length : stateScopedItems.filter((item) => item.type === tab.id).length, selected: typeFilter === tab.id, onSelect: () => setTypeFilter(tab.id) }))}
            />
            <label className="action-center-search"><Search size={15} /><span className="sr-only">{text("Search action center", "Doorzoek actiecentrum")}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text("Search reference, title or person", "Zoek referentie, titel of persoon")} /></label>
          </div>

          <div className="unified-action-list">
            {visibleItems.length ? visibleItems.map((item) => (
              <button className={overdue(item) ? "overdue" : ""} type="button" onClick={() => openItem(item)} key={`${item.source}:${item.id}`}>
                <span className={`unified-action-icon ${item.type}`}>{typeIcon(item.type)}</span>
                <span className="unified-action-copy">
                  <span><b>{typeTabs.find((tab) => tab.id === item.type)?.label ?? item.type}</b><em>{item.reference}</em>{isEscalated(item) ? <i className="unified-action-flag"><ShieldAlert size={10} /> {text("escalation", "escalatie")}</i> : null}</span>
                  <strong>{item.title}</strong>
                  {/* What has to happen next, in words, so the row can be acted on without
                      opening it first. */}
                  <span className={`unified-action-next step-${nextStepFor(item)}`}><ArrowRight size={11} /> {nextStepLabel(item)}</span>
                  <small className={overdue(item) ? "overdue" : ""}>{ownerLabel(item)} · {deadlineLabel(item)}</small>
                </span>
                <span className={`unified-action-priority ${item.priority}`}>{priorityText(item.priority, text)}</span>
                <span className={`document-status ${isSettledStatus(item.status) ? "approved" : ""}`}>{statusText(item.status, text)}</span>
                <ArrowRight size={15} />
              </button>
            )) : <div className="action-center-empty"><Filter size={24} /><div><strong>{view === "mine" ? text("Nothing is waiting for you", "Er wacht niets op jou") : view === "deadlines" && deadlineFilter === "overdue" ? text("Nothing is overdue", "Niets is te laat") : text("No records match this view", "Geen registraties in deze weergave")}</strong></div><button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => { setTypeFilter("all"); setWorkFilter("all"); setDeadlineFilter("all"); setSearch(""); }}>{text("Clear filters", "Wis filters")}</button></div>}
          </div>
        </div>

        {/* What needs a decision today, instead of a drawing of a floor plan that was not
            the real one. */}
        <div className="action-focus-card">
          <header><span><ShieldAlert size={17} /></span><div><h2>{text("Needs attention now", "Vraagt nu aandacht")}</h2><p>{scopedItems.filter(isEscalated).length} {text("late or urgent records", "te late of urgente registraties")}</p></div></header>
          {escalations.length ? (
            <ul className="action-escalation-list">
              {escalations.map((item) => (
                <li key={`${item.source}:${item.id}`}>
                  <button type="button" onClick={() => openItem(item)}>
                    <strong>{item.reference} · {item.title}</strong>
                    <small>{nextStepLabel(item)} · {deadlineLabel(item)}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="action-focus-empty"><CheckCircle2 size={16} /> {text("Nothing late or urgent.", "Niets te laat of urgent.")}</p>}
          <dl className="action-focus-counts">
            <div><dt>{text("Without an owner", "Zonder verantwoordelijke")}</dt><dd>{scopedItems.filter(unassigned).length}</dd></div>
            <div><dt>{text("Waiting for verification", "Wacht op verificatie")}</dt><dd>{scopedItems.filter((item) => item.status === "ready_for_verification").length}</dd></div>
            <div><dt>{text("Due within 7 days", "Binnen 7 dagen")}</dt><dd>{scopedItems.filter(withinWeek).length}</dd></div>
          </dl>
          <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => openProjectArea("drawings")}><MapPin size={14} /> {text("Open coordinated drawing", "Open gecoördineerde tekening")} · {data.drawingPins.length} {text("points", "punten")} <ArrowRight size={14} /></button>
        </div>
      </div>
    </section>
  );
}
