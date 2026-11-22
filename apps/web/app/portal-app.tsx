"use client";

import {
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  Download,
  FileText,
  History,
  Loader2,
  LogOut,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Send,
  Upload,
  X,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SectionNav } from "@/app/section-nav";
import { PortalGuide } from "@/app/visual-walkthrough";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import { useBackToClose } from "@/lib/navigation/app-history";
import { downloadProjectFile, loadProjectFilePreviewObjectUrl, uploadProjectFile } from "@/lib/storage/gateway";
import { statusMeta } from "@/lib/documents/document-register.mjs";
import { priorityText, statusText } from "@/lib/status-labels";
import {
  clientSections,
  contractorSections,
  decisionLog,
  eventLabels,
  eventsByRound,
  isClosedShare,
  isOverdueShare,
  label,
  portalStepsFor,
  publicationTypes,
  recordTypeLabels,
  requestedActionLabels,
  shareStatusLabels,
  stepNeedsComment,
} from "@/lib/portal/portal-model.mjs";
import {
  loadPortalContext,
  loadPortalSnapshot,
  recordPortalAccess,
  respondInPortal,
  type PortalAudience,
  type PortalEvent,
  type PortalShare,
  type PortalSnapshot,
} from "@/lib/portal/portal-data";

type ProjectOption = { id: string; name: string; code: string };
type BuildingOption = { id: string; name: string };

const toneClass: Record<string, string> = {
  red: "ui-status-badge ui-status-badge--red",
  amber: "ui-status-badge ui-status-badge--amber",
  green: "ui-status-badge ui-status-badge--green",
  blue: "ui-status-badge ui-status-badge--blue",
  neutral: "ui-status-badge portal-badge-neutral",
};

export function ShareStatusBadge({ status, language }: { status: string; language: "en" | "nl" }) {
  const meta = (shareStatusLabels as Record<string, { en: string; nl: string; tone: string }>)[status];
  return <span className={toneClass[meta?.tone ?? "neutral"]}>{meta ? (language === "nl" ? meta.nl : meta.en) : status}</span>;
}

function formatDate(value: string | null | undefined, locale: string, withTime = false) {
  if (!value) return "";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, withTime
    ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Paramaribo" }
    : { day: "numeric", month: "short", year: "numeric", timeZone: "America/Paramaribo" });
}

/**
 * The contractor's and the client's own environment (requirements 6 and 21). A separate shell:
 * a portal user never sees the supervisor workspace, its navigation or its settings, and every
 * row on these screens is already limited to the user's own organisation by the database.
 */
export function PortalApp({
  client,
  mode,
  projectId,
  projectName,
  projects,
  buildings,
  userName,
  brand,
  onSwitchProject,
  onSignOut,
  submissionWorkspace,
}: {
  client: SupabaseClient;
  mode: PortalAudience;
  projectId: string;
  projectName: string;
  projects: ProjectOption[];
  buildings: BuildingOption[];
  userName: string;
  brand: ReactNode;
  onSwitchProject: (projectId: string) => void;
  onSignOut: () => void;
  /** The existing controlled-submission form (RFI, RFA, WCR, inspection request), when the role may originate one. */
  submissionWorkspace?: ReactNode;
}) {
  const { language, locale, text } = useLanguage();
  const queryClient = useQueryClient();
  const [section, setSection] = useState("dashboard");
  const [openShareId, setOpenShareId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const contextQuery = useQuery({
    queryKey: ["portal-context", projectId],
    queryFn: () => loadPortalContext(client, projectId),
    staleTime: 5 * 60_000,
  });
  const snapshotQuery = useQuery({
    queryKey: ["portal-snapshot", projectId],
    queryFn: () => loadPortalSnapshot(client, projectId),
    refetchInterval: 60_000,
  });
  const notificationsQuery = useQuery({
    queryKey: ["portal-notifications", projectId],
    queryFn: async () => {
      const result = await client.from("notifications").select("id,title,body,source_id,created_at,read_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(30);
      if (result.error) throw result.error;
      return result.data ?? [];
    },
    refetchInterval: 60_000,
  });

  const snapshot = snapshotQuery.data;
  const shares = useMemo(() => snapshot?.shares ?? [], [snapshot]);
  const context = contextQuery.data;
  const rights = { respond: Boolean(context?.can_respond), review: Boolean(context?.can_review), approve: Boolean(context?.can_approve) };
  const buildingName = (id: string | null) => buildings.find((building) => building.id === id)?.name ?? "";
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["portal-snapshot", projectId] });
    void queryClient.invalidateQueries({ queryKey: ["portal-notifications", projectId] });
  };

  const contractor = useMemo(() => contractorSections(shares) as Record<"assigned" | "pendingActions" | "sharedDocuments" | "history" | "awaiting" | "overdue" | "returned" | "upcoming", PortalShare[]>, [shares]);
  const clientView = useMemo(() => clientSections(shares) as Record<"publications" | "currentPublications" | "progress" | "photos" | "documents" | "review" | "openReview" | "overdueReview" | "issues" | "correspondence", PortalShare[]>, [shares]);
  const openShare = shares.find((share) => share.id === openShareId) ?? null;
  const unread = (notificationsQuery.data ?? []).filter((item) => !item.read_at).length;

  const sections = mode === "contractor"
    ? [
      { id: "dashboard", label: text("Dashboard", "Dashboard"), count: contractor.awaiting.length },
      { id: "assigned", label: text("Assigned to me", "Aan mij toegewezen"), count: contractor.assigned.length },
      { id: "responses", label: text("Responses & submissions", "Reacties & indieningen") },
      { id: "pending", label: text("Pending actions", "Openstaande acties"), count: contractor.pendingActions.length },
      { id: "history", label: text("History", "Historie"), count: contractor.history.length },
      { id: "documents", label: text("Shared documents", "Gedeelde documenten"), count: contractor.sharedDocuments.length },
    ]
    : [
      { id: "dashboard", label: text("Client dashboard", "Dashboard"), count: clientView.openReview.length },
      { id: "progress", label: text("Project progress", "Projectvoortgang"), count: clientView.progress.length },
      { id: "reports", label: text("Reports & publications", "Rapporten & publicaties"), count: clientView.currentPublications.length },
      { id: "photos", label: text("Photos & site updates", "Foto's & updates"), count: clientView.photos.length },
      { id: "documents", label: text("Shared project documents", "Gedeelde projectdocumenten"), count: clientView.documents.length },
      { id: "review", label: text("Items for client review", "Ter beoordeling"), count: clientView.openReview.length },
      { id: "issues", label: text("Key issues & risks", "Belangrijke issues & risico's"), count: clientView.issues.length },
      { id: "schedule", label: text("Milestones & schedule", "Mijlpalen & planning") },
      { id: "decisions", label: text("Correspondence & decisions", "Correspondentie & besluiten") },
      { id: "history", label: text("History & notifications", "Historie & meldingen"), count: unread || undefined },
    ];

  const row = (share: PortalShare) => (
    <PortalRow key={share.id} share={share} language={language} locale={locale} text={text} buildingName={buildingName(share.building_id)} open={() => setOpenShareId(share.id)} />
  );

  const list = (items: PortalShare[], empty: string) => items.length
    ? <div className="portal-list">{items.map(row)}</div>
    : <p className="record-list-empty">{empty}</p>;

  let body: ReactNode = null;
  if (snapshotQuery.isLoading) {
    body = <p className="portal-loading"><Loader2 className="spin" size={16} /> {text("Loading…", "Laden…")}</p>;
  } else if (snapshotQuery.isError) {
    body = <p className="field-warning" role="alert">{text("The portal could not be loaded. Try again.", "Het portaal kon niet worden geladen. Probeer opnieuw.")} <button className="ui-button ui-button--secondary ui-button--sm" type="button" onClick={refresh}><RefreshCw size={14} /> {text("Retry", "Opnieuw")}</button></p>;
  } else if (mode === "contractor") {
    if (section === "dashboard") {
      body = (
        <>
          <div className="portal-stats" role="list">
            <PortalStat value={contractor.awaiting.length} label={text("Awaiting your response", "Wacht op jouw reactie")} />
            <PortalStat value={contractor.overdue.length} label={text("Overdue", "Over tijd")} tone={contractor.overdue.length ? "red" : undefined} />
            <PortalStat value={contractor.returned.length} label={text("Returned", "Teruggestuurd")} tone={contractor.returned.length ? "amber" : undefined} />
            <PortalStat value={contractor.upcoming.length} label={text("Due within 7 days", "Binnen 7 dagen")} />
          </div>
          <PortalPanel title={text("Needs your response", "Wacht op jouw reactie")}>{list(contractor.awaiting, text("Nothing is waiting for you.", "Er wacht niets op jou."))}</PortalPanel>
          {contractor.upcoming.length ? <PortalPanel title={text("Upcoming deadlines", "Komende deadlines")}>{list(contractor.upcoming, "")}</PortalPanel> : null}
        </>
      );
    } else if (section === "assigned") {
      body = <PortalPanel title={text("Assigned to me", "Aan mij toegewezen")}>{list(contractor.assigned, text("No assigned records.", "Geen toegewezen records."))}</PortalPanel>;
    } else if (section === "responses") {
      body = (
        <>
          {submissionWorkspace ? (
            <div className="portal-submission-toggle">
              <button className={`ui-button ui-button--md ${submitting ? "ui-button--secondary" : "ui-button--primary"}`} type="button" aria-expanded={submitting} onClick={() => setSubmitting((value) => !value)}>
                {submitting ? text("Close the submission form", "Indieningsformulier sluiten") : text("New submission (RFI, RFA, WCR, inspection request)", "Nieuwe indiening (RFI, RFA, WCR, inspectieaanvraag)")}
              </button>
            </div>
          ) : null}
          {submitting && submissionWorkspace ? <div className="portal-submission">{submissionWorkspace}</div> : null}
          <ContractorResponses client={client} projectId={projectId} snapshot={snapshot!} openShare={setOpenShareId} />
        </>
      );
    } else if (section === "pending") {
      body = <PortalPanel title={text("Pending actions", "Openstaande acties")}>{list(contractor.pendingActions, text("No open actions.", "Geen open acties."))}</PortalPanel>;
    } else if (section === "history") {
      body = <PortalPanel title={text("History", "Historie")}>{list(contractor.history, text("No completed items yet.", "Nog geen afgeronde items."))}</PortalPanel>;
    } else {
      body = <SharedDocuments snapshot={snapshot!} shares={contractor.sharedDocuments} open={setOpenShareId} />;
    }
  } else {
    if (section === "dashboard") {
      const latest = clientView.currentPublications[0];
      body = (
        <>
          <div className="portal-stats" role="list">
            <PortalStat value={clientView.openReview.length} label={text("Open client decisions", "Open besluiten")} />
            <PortalStat value={clientView.overdueReview.length} label={text("Overdue reviews", "Beoordelingen over tijd")} tone={clientView.overdueReview.length ? "red" : undefined} />
            <PortalStat value={clientView.issues.filter((share) => !isClosedShare(share)).length} label={text("Open key issues", "Open issues")} />
            <PortalStat value={clientView.currentPublications.length} label={text("Published reports", "Gepubliceerde rapporten")} />
          </div>
          <PortalPanel title={text("Latest published report", "Laatst gepubliceerd rapport")}>
            {latest ? list([latest], "") : <p className="record-list-empty">{text("No report has been published yet.", "Er is nog geen rapport gepubliceerd.")}</p>}
          </PortalPanel>
          <PortalPanel title={text("Waiting for your decision", "Wacht op jouw besluit")}>{list(clientView.openReview, text("Nothing is waiting for a decision.", "Er wacht niets op een besluit."))}</PortalPanel>
          {clientView.issues.length ? <PortalPanel title={text("Key issues & risks", "Belangrijke issues & risico's")}>{list(clientView.issues.filter((share) => !isClosedShare(share)).slice(0, 5), "")}</PortalPanel> : null}
          {clientView.photos.length ? <PortalPanel title={text("Latest site photos", "Laatste foto's")}><PhotoGrid client={client} shares={clientView.photos.slice(0, 6)} snapshot={snapshot!} open={setOpenShareId} /></PortalPanel> : null}
          {clientView.documents.length ? <PortalPanel title={text("Recently shared documents", "Recent gedeelde documenten")}>{list(clientView.documents.slice(0, 5), "")}</PortalPanel> : null}
        </>
      );
    } else if (section === "progress") {
      body = <PortalPanel title={text("Approved progress updates", "Goedgekeurde voortgangsupdates")}>{list(clientView.progress, text("No progress update has been published.", "Er is nog geen voortgangsupdate gepubliceerd."))}</PortalPanel>;
    } else if (section === "reports") {
      body = <PublicationList shares={clientView.publications} language={language} locale={locale} text={text} open={setOpenShareId} />;
    } else if (section === "photos") {
      body = <PortalPanel title={text("Photos & site updates", "Foto's & updates")}>{clientView.photos.length ? <PhotoGrid client={client} shares={clientView.photos} snapshot={snapshot!} open={setOpenShareId} /> : <p className="record-list-empty">{text("No photos have been released.", "Er zijn geen foto's vrijgegeven.")}</p>}</PortalPanel>;
    } else if (section === "documents") {
      body = <SharedDocuments snapshot={snapshot!} shares={clientView.documents} open={setOpenShareId} />;
    } else if (section === "review") {
      body = <PortalPanel title={text("Items for client review", "Ter beoordeling")}>{list(clientView.review, text("Nothing has been routed to you for review.", "Er is niets ter beoordeling naar je gestuurd."))}</PortalPanel>;
    } else if (section === "issues") {
      body = <PortalPanel title={text("Key issues & risks", "Belangrijke issues & risico's")}>{list(clientView.issues, text("No issues have been shared.", "Er zijn geen issues gedeeld."))}</PortalPanel>;
    } else if (section === "schedule") {
      const schedule = [...clientView.publications.filter((share) => share.publication_type === "schedule" && share.status !== "superseded"),
        ...clientView.documents.filter((share) => snapshot?.documents.get(share.record_id)?.folder_code === "03")];
      body = <PortalPanel title={text("Milestones & schedule", "Mijlpalen & planning")}>{list(schedule, text("No schedule has been shared.", "Er is geen planning gedeeld."))}</PortalPanel>;
    } else if (section === "decisions") {
      body = <DecisionLog snapshot={snapshot!} correspondence={clientView.correspondence} open={setOpenShareId} />;
    } else {
      body = <PortalHistory client={client} snapshot={snapshot!} notifications={notificationsQuery.data ?? []} open={setOpenShareId} refresh={refresh} />;
    }
  }

  return (
    <div className="portal-shell">
      <header className="portal-topbar">
        <div className="portal-brand">{brand}</div>
        <div className="portal-identity">
          <strong>{mode === "contractor" ? text("Contractor portal", "Aannemersportaal") : text("Client portal", "Opdrachtgeversportaal")}</strong>
          <small>{context?.party_name ?? text("Organisation not linked", "Organisatie niet gekoppeld")} · {userName}</small>
        </div>
        <div className="portal-top-actions">
          {projects.length > 1 ? (
            <label className="portal-project-select">
              <span className="sr-only">{text("Project", "Project")}</span>
              <select value={projectId} onChange={(event) => onSwitchProject(event.target.value)}>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}
              </select>
            </label>
          ) : <span className="portal-project-name">{projectName}</span>}
          <button className="icon-button" type="button" aria-label={`${text("Notifications", "Meldingen")}${unread ? `, ${unread} ${text("unread", "ongelezen")}` : ""}`} onClick={() => setSection("history")}>
            <Bell size={17} />{unread ? <span className="notification-dot" /> : null}
          </button>
          <PortalGuide audience={mode === "contractor" ? "contractor" : "client"} onNavigate={(target) => setSection(target.area)} />
          <LanguageSwitcher compact />
          <button className="ui-button ui-button--quiet ui-button--sm" type="button" onClick={onSignOut}><LogOut size={15} /> {text("Sign out", "Afmelden")}</button>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="portal-main">
        {!contextQuery.isLoading && !context ? (
          <p className="field-warning" role="alert">{text("Your account is not linked to a contractor or client organisation on this project yet. Ask CODECO to link it.", "Je account is in dit project nog niet aan een aannemer of opdrachtgever gekoppeld. Vraag CODECO dit te doen.")}</p>
        ) : null}
        <SectionNav
          label={mode === "contractor" ? text("Contractor portal", "Aannemersportaal") : text("Client portal", "Opdrachtgeversportaal")}
          items={sections.map((item) => ({ id: item.id, label: item.label, count: item.count, selected: section === item.id, onSelect: () => setSection(item.id) }))}
        />
        <div className="portal-section">{body}</div>
      </main>
      {openShare && snapshot ? (
        <ShareDetail
          client={client}
          share={openShare}
          snapshot={snapshot}
          rights={rights}
          buildingName={buildingName(openShare.building_id)}
          defaultBuildingId={openShare.building_id ?? buildings[0]?.id ?? ""}
          close={() => setOpenShareId(null)}
          changed={refresh}
        />
      ) : null}
    </div>
  );
}

function PortalStat({ value, label: name, tone }: { value: number; label: string; tone?: "red" | "amber" }) {
  return (
    <div className={`ui-stat portal-stat${tone ? ` portal-stat--${tone}` : ""}`} role="listitem">
      <span className="ui-stat__value">{value}</span>
      <span className="ui-stat__label">{name}</span>
    </div>
  );
}

function PortalPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="ui-panel portal-panel">
      <div className="ui-panel__heading"><h2>{title}</h2></div>
      {children}
    </section>
  );
}

function PortalRow({ share, language, locale, text, buildingName, open }: {
  share: PortalShare; language: "en" | "nl"; locale: string; text: (en: string, nl: string) => string; buildingName: string; open: () => void;
}) {
  const overdue = isOverdueShare(share);
  return (
    <button className="ui-list-row portal-row" type="button" onClick={open}>
      <span className="portal-row-main">
        <span className="ui-list-row__code">{share.record_code ?? label(recordTypeLabels, share.record_type, language)} · {label(recordTypeLabels, share.record_type, language)}{share.publication_version > 1 ? ` · v${share.publication_version}` : ""}</span>
        <span className="ui-list-row__title">{share.title}</span>
        <span className="ui-list-row__meta">
          {label(requestedActionLabels, share.requested_action, language)}
          {share.due_at ? ` · ${text("due", "uiterlijk")} ${formatDate(share.due_at, locale)}` : ""}
          {buildingName ? ` · ${buildingName}` : ""}
          {share.round > 1 ? ` · ${text("round", "ronde")} ${share.round}` : ""}
        </span>
      </span>
      <span className="portal-row-side">
        {overdue ? <span className="ui-status-badge ui-status-badge--red"><AlertTriangle size={12} /> {text("Overdue", "Over tijd")}</span> : null}
        <ShareStatusBadge status={share.status} language={language} />
      </span>
    </button>
  );
}

function PublicationList({ shares, language, locale, text, open }: {
  shares: PortalShare[]; language: "en" | "nl"; locale: string; text: (en: string, nl: string) => string; open: (id: string) => void;
}) {
  const [type, setType] = useState("");
  const [period, setPeriod] = useState("");
  const filtered = shares.filter((share) => (!type || share.publication_type === type)
    && (!period || (share.period_start ?? "").slice(0, 7) === period || (share.period_end ?? "").slice(0, 7) === period));
  const typeName = (id: string | null) => publicationTypes.find((item) => item.id === id)?.[language] ?? id ?? "";
  return (
    <PortalPanel title={text("Reports & publications", "Rapporten & publicaties")}>
      <div className="portal-filters">
        <label className="form-field"><span>{text("Report type", "Rapporttype")}</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">{text("All", "Alle")}</option>
            {publicationTypes.map((item) => <option key={item.id} value={item.id}>{item[language]}</option>)}
          </select>
        </label>
        <label className="form-field"><span>{text("Reporting period (month)", "Rapportageperiode (maand)")}</span>
          <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
        </label>
      </div>
      {filtered.length ? (
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr>
              <th>{text("Report", "Rapport")}</th><th>{text("Type", "Type")}</th><th>{text("Period", "Periode")}</th>
              <th>{text("Issued", "Uitgegeven")}</th><th>{text("Version", "Versie")}</th><th>{text("Status", "Status")}</th>
            </tr></thead>
            <tbody>
              {filtered.map((share) => (
                <tr key={share.id}>
                  <td><button className="portal-link" type="button" onClick={() => open(share.id)}>{share.title}</button></td>
                  <td>{typeName(share.publication_type)}</td>
                  <td>{share.period_start ? `${formatDate(share.period_start, locale)}${share.period_end && share.period_end !== share.period_start ? ` – ${formatDate(share.period_end, locale)}` : ""}` : ""}</td>
                  <td>{formatDate(share.assigned_at, locale)}</td>
                  <td>v{share.publication_version}{share.status === "published" ? ` · ${text("current", "actueel")}` : ""}</td>
                  <td><ShareStatusBadge status={share.status} language={language} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="record-list-empty">{text("No report has been published for this selection.", "Voor deze selectie is geen rapport gepubliceerd.")}</p>}
    </PortalPanel>
  );
}

function SharedDocuments({ snapshot, shares, open }: { snapshot: PortalSnapshot; shares: PortalShare[]; open: (id: string) => void }) {
  const { language, locale, text } = useLanguage();
  if (!shares.length) return <PortalPanel title={text("Shared documents", "Gedeelde documenten")}><p className="record-list-empty">{text("No documents have been shared.", "Er zijn geen documenten gedeeld.")}</p></PortalPanel>;
  return (
    <PortalPanel title={text("Shared documents", "Gedeelde documenten")}>
      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead><tr><th>{text("Number", "Nummer")}</th><th>{text("Title", "Titel")}</th><th>{text("Released revision", "Vrijgegeven revisie")}</th><th>{text("Status", "Status")}</th><th>{text("Shared", "Gedeeld")}</th></tr></thead>
          <tbody>
            {shares.map((share) => {
              const document = snapshot.documents.get(share.record_id);
              // The newest revision released to this share (F15); the register's internal current pointer is not shown.
              const current = snapshot.revisions.filter((revision) => revision.share_id === share.id).sort((a, b) => String(b.uploaded_at).localeCompare(String(a.uploaded_at)))[0];
              const status = statusMeta(current?.review_status ?? "");
              return (
                <tr key={share.id}>
                  <td>{document?.document_number ?? "–"}</td>
                  <td><button className="portal-link" type="button" onClick={() => open(share.id)}>{document?.title ?? share.title}</button></td>
                  <td>{current?.revision ?? "–"}</td>
                  <td><span className={toneClass[status.tone] ?? toneClass.neutral}>{language === "nl" ? status.nl : status.en}</span></td>
                  <td>{formatDate(share.assigned_at, locale)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PortalPanel>
  );
}

function PhotoThumb({ client, fileId, alt }: { client: SupabaseClient; fileId: string; alt: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    void loadProjectFilePreviewObjectUrl(client, fileId).then((value) => {
      objectUrl = value.url;
      if (active) setUrl(value.url); else URL.revokeObjectURL(value.url);
    }).catch(() => undefined);
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [client, fileId]);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={alt} loading="lazy" /> : <Camera size={22} aria-hidden="true" />;
}

function PhotoGrid({ client, shares, snapshot, open }: { client: SupabaseClient; shares: PortalShare[]; snapshot: PortalSnapshot; open: (id: string) => void }) {
  const { locale } = useLanguage();
  return (
    <div className="portal-photo-grid">
      {shares.map((share) => {
        const file = snapshot.files.get(share.record_id);
        const isImage = (file?.mime_type ?? "").startsWith("image/");
        return (
          <button key={share.id} type="button" className="portal-photo" onClick={() => open(share.id)}>
            <span className="portal-photo-frame">{isImage ? <PhotoThumb client={client} fileId={share.record_id} alt={share.title} /> : <FileText size={22} aria-hidden="true" />}</span>
            <span className="portal-photo-caption"><strong>{share.title}</strong><small>{formatDate(share.assigned_at, locale)}</small></span>
          </button>
        );
      })}
    </div>
  );
}

function ContractorResponses({ client, projectId, snapshot, openShare }: { client: SupabaseClient; projectId: string; snapshot: PortalSnapshot; openShare: (id: string) => void }) {
  const { language, locale, text } = useLanguage();
  const submissions = useQuery({
    queryKey: ["portal-own-submissions", projectId],
    queryFn: async () => {
      const result = await client.from("project_register_entries").select("id,register_type,entry_number,title,status,occurred_at,created_at").eq("project_id", projectId)
        .in("register_type", ["wcr", "rfi", "rfa", "inspection_request"]).order("created_at", { ascending: false }).limit(200);
      if (result.error) throw result.error;
      return result.data ?? [];
    },
  });
  const responded = snapshot.shares.filter((share) => snapshot.events.some((event) => event.share_id === share.id && event.actor_side === "contractor" && !["view", "download"].includes(event.action)));
  return (
    <>
      <PortalPanel title={text("My responses", "Mijn reacties")}>
        {responded.length ? (
          <div className="portal-list">
            {responded.map((share) => {
              const last = snapshot.events.filter((event) => event.share_id === share.id && event.actor_side === "contractor").at(-1);
              return (
                <button key={share.id} type="button" className="ui-list-row portal-row" onClick={() => openShare(share.id)}>
                  <span className="portal-row-main">
                    <span className="ui-list-row__code">{share.record_code} · {label(recordTypeLabels, share.record_type, language)}</span>
                    <span className="ui-list-row__title">{share.title}</span>
                    <span className="ui-list-row__meta">{last ? `${label(eventLabels, last.action, language)} · ${formatDate(last.created_at, locale, true)}` : ""}</span>
                  </span>
                  <span className="portal-row-side"><ShareStatusBadge status={share.status} language={language} /></span>
                </button>
              );
            })}
          </div>
        ) : <p className="record-list-empty">{text("No responses yet.", "Nog geen reacties.")}</p>}
      </PortalPanel>
      <PortalPanel title={text("My submissions (RFI, RFA, WCR, inspection request)", "Mijn indieningen (RFI, RFA, WCR, inspectieaanvraag)")}>
        {submissions.data?.length ? (
          <div className="portal-list">
            {submissions.data.map((entry) => (
              <div key={String(entry.id)} className="ui-list-row">
                <span className="portal-row-main">
                  <span className="ui-list-row__code">{String(entry.entry_number)} · {String(entry.register_type).toUpperCase()}</span>
                  <span className="ui-list-row__title">{String(entry.title)}</span>
                  <span className="ui-list-row__meta">{formatDate(String(entry.created_at), locale)}</span>
                </span>
                <span className="ui-status-badge ui-status-badge--blue">{statusText(String(entry.status), text)}</span>
              </div>
            ))}
          </div>
        ) : <p className="record-list-empty">{submissions.isLoading ? text("Loading…", "Laden…") : text("No submissions.", "Geen indieningen.")}</p>}
      </PortalPanel>
    </>
  );
}

function DecisionLog({ snapshot, correspondence, open }: { snapshot: PortalSnapshot; correspondence: PortalShare[]; open: (id: string) => void }) {
  const { language, locale, text } = useLanguage();
  const decisions = decisionLog(snapshot.events) as PortalEvent[];
  const shareById = new Map(snapshot.shares.map((share) => [share.id, share]));
  const letters = [...correspondence, ...snapshot.shares.filter((share) => share.record_type === "document" && snapshot.documents.get(share.record_id)?.folder_code === "09")];
  return (
    <>
      <PortalPanel title={text("Decision log", "Besluitenlog")}>
        {decisions.length ? (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>{text("Date", "Datum")}</th><th>{text("Item", "Item")}</th><th>{text("Decision", "Besluit")}</th><th>{text("By", "Door")}</th><th>{text("Comment", "Opmerking")}</th></tr></thead>
              <tbody>
                {decisions.map((event) => {
                  const share = shareById.get(event.share_id);
                  return (
                    <tr key={event.id}>
                      <td>{formatDate(event.created_at, locale, true)}</td>
                      <td>{share ? <button className="portal-link" type="button" onClick={() => open(share.id)}>{share.record_code ?? share.title}</button> : ""}</td>
                      <td>{label(eventLabels, event.action, language)}</td>
                      <td>{event.actor_name ?? ""}</td>
                      <td>{event.comment ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="record-list-empty">{text("No decisions recorded yet.", "Nog geen besluiten vastgelegd.")}</p>}
      </PortalPanel>
      <PortalPanel title={text("Correspondence", "Correspondentie")}>
        {letters.length ? <div className="portal-list">{letters.map((share) => (
          <button key={share.id} type="button" className="ui-list-row portal-row" onClick={() => open(share.id)}>
            <span className="portal-row-main"><span className="ui-list-row__code">{share.record_code}</span><span className="ui-list-row__title">{share.title}</span></span>
            <span className="portal-row-side"><ShareStatusBadge status={share.status} language={language} /></span>
          </button>
        ))}</div> : <p className="record-list-empty">{text("No correspondence has been shared.", "Er is geen correspondentie gedeeld.")}</p>}
      </PortalPanel>
    </>
  );
}

function PortalHistory({ client, snapshot, notifications, open, refresh }: {
  client: SupabaseClient; snapshot: PortalSnapshot; notifications: Array<{ id: string; title: string; body: string; source_id: string | null; created_at: string; read_at: string | null }>;
  open: (id: string) => void; refresh: () => void;
}) {
  const { language, locale, text } = useLanguage();
  const shareById = new Map(snapshot.shares.map((share) => [share.id, share]));
  const events = snapshot.events.filter((event) => !["view"].includes(event.action)).slice().sort((a, b) => Number(b.sequence) - Number(a.sequence)).slice(0, 100);
  return (
    <>
      <PortalPanel title={text("Notifications", "Meldingen")}>
        {notifications.length ? (
          <div className="portal-list">
            {notifications.map((item) => (
              <button key={item.id} type="button" className={`ui-list-row portal-row${item.read_at ? "" : " portal-row--unread"}`} onClick={() => {
                if (!item.read_at) void client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", item.id).then(refresh);
                if (item.source_id && shareById.has(item.source_id)) open(item.source_id);
              }}>
                <span className="portal-row-main"><span className="ui-list-row__title">{item.title}</span><span className="ui-list-row__meta">{formatDate(item.created_at, locale, true)}</span></span>
                {item.read_at ? null : <span className="ui-status-badge ui-status-badge--blue">{text("New", "Nieuw")}</span>}
              </button>
            ))}
          </div>
        ) : <p className="record-list-empty">{text("No notifications.", "Geen meldingen.")}</p>}
      </PortalPanel>
      <PortalPanel title={text("History", "Historie")}>
        {events.length ? (
          <ol className="portal-timeline">
            {events.map((event) => {
              const share = shareById.get(event.share_id);
              return (
                <li key={event.id}>
                  <strong>{label(eventLabels, event.action, language)}</strong>
                  {share ? <> · <button className="portal-link" type="button" onClick={() => open(share.id)}>{share.record_code ?? share.title}</button></> : null}
                  <small>{event.actor_name ?? ""} · {formatDate(event.created_at, locale, true)}</small>
                </li>
              );
            })}
          </ol>
        ) : <p className="record-list-empty">{text("No history yet.", "Nog geen historie.")}</p>}
      </PortalPanel>
    </>
  );
}

/** The fields of a contractor response per record type (6.2). Stored in the event payload. */
function responseFields(share: PortalShare, text: (en: string, nl: string) => string) {
  if (share.record_type === "finding") return [
    { key: "cause", label: text("Cause analysis", "Oorzaakanalyse"), type: "textarea" },
    { key: "corrective_action", label: text("Corrective action", "Corrigerende maatregel"), type: "textarea" },
    { key: "target_date", label: text("Target date", "Streefdatum"), type: "date" },
  ];
  if (share.record_type === "register_entry" && share.requested_action === "propose") return [
    { key: "justification", label: text("Proposal / justification", "Voorstel / onderbouwing"), type: "textarea" },
    { key: "cost_impact", label: text("Cost impact", "Kostenimpact"), type: "text" },
    { key: "time_impact_days", label: text("Time impact (days)", "Tijdsimpact (dagen)"), type: "number" },
  ];
  if (share.record_type === "register_entry") return [
    { key: "explanation", label: text("Explanation / dates", "Toelichting / data"), type: "textarea" },
    { key: "mitigation", label: text("Mitigation or recovery", "Mitigatie of herstel"), type: "textarea" },
  ];
  return [];
}

function ShareDetail({ client, share, snapshot, rights, buildingName, defaultBuildingId, close, changed }: {
  client: SupabaseClient; share: PortalShare; snapshot: PortalSnapshot; rights: { respond: boolean; review: boolean; approve: boolean };
  buildingName: string; defaultBuildingId: string; close: () => void; changed: () => void;
}) {
  const { language, locale, text } = useLanguage();
  useBackToClose(true, close);
  const [step, setStep] = useState("");
  const [comment, setComment] = useState("");
  const [payload, setPayload] = useState<Record<string, string>>({});
  const [uploads, setUploads] = useState<Array<{ id: string; name: string }>>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => { void recordPortalAccess(client, share.id, "view"); }, [client, share.id]);

  const steps = portalStepsFor(share, rights) as string[];
  const files = snapshot.shareFiles.filter((item) => item.share_id === share.id);
  const shared = files.filter((item) => item.source === "shared");
  const responses = files.filter((item) => item.source === "response");
  const rounds = eventsByRound(snapshot.events.filter((event) => event.share_id === share.id)) as Array<{ round: number; events: PortalEvent[] }>;
  const fields = step === "respond" ? responseFields(share, text) : [];
  const document = share.record_type === "document" ? snapshot.documents.get(share.record_id) : undefined;
  const revisions = document ? snapshot.revisions.filter((revision) => revision.share_id === share.id).sort((a, b) => String(b.uploaded_at).localeCompare(String(a.uploaded_at))) : [];
  const latestReleased = revisions[0]?.id;
  const needsComment = step ? stepNeedsComment(step, share.audience) : false;
  const canUpload = share.audience === "contractor" && rights.respond && ["respond", "submit_evidence", "mark_complete", "comment"].includes(step);

  const download = async (fileId: string) => {
    const file = snapshot.files.get(fileId);
    try {
      await downloadProjectFile(client, fileId, file?.original_name ?? "file");
      void recordPortalAccess(client, share.id, "download", fileId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text("The file could not be downloaded.", "Het bestand kon niet worden gedownload."));
    }
  };

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setError("");
    for (const file of Array.from(list)) {
      try {
        setProgress(0);
        const result = await uploadProjectFile(client, {
          projectId: share.project_id,
          buildingId: defaultBuildingId,
          category: file.type.startsWith("image/") ? "photo" : "evidence",
          file,
          onProgress: setProgress,
        });
        setUploads((current) => [...current, { id: result.fileId, name: file.name }]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : text("The upload failed.", "Het uploaden is mislukt."));
      } finally {
        setProgress(null);
      }
    }
  };

  const submit = async () => {
    if (!step) return;
    if (needsComment && !comment.trim()) { setError(text("Add a comment.", "Voeg een opmerking toe.")); return; }
    setBusy(true);
    setError("");
    try {
      const cleanPayload = Object.fromEntries(Object.entries(payload).filter(([, value]) => value.trim()));
      await respondInPortal(client, { shareId: share.id, action: step, comment, payload: cleanPayload, fileIds: uploads.map((item) => item.id) });
      setStep(""); setComment(""); setPayload({}); setUploads([]);
      changed();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text("Not saved.", "Niet opgeslagen."));
    } finally {
      setBusy(false);
    }
  };

  const stepLabel = (id: string) => ({
    acknowledge: text("Acknowledge receipt", "Ontvangst bevestigen"),
    respond: share.status === "returned" ? text("Resubmit", "Opnieuw indienen") : text("Respond", "Reageren"),
    submit_evidence: text("Submit evidence", "Bewijs indienen"),
    mark_complete: text("Report complete", "Gereed melden"),
    comment: text("Comment", "Opmerking"),
    approve: text("Approve", "Goedkeuren"),
    reject: text("Reject", "Afwijzen"),
    request_clarification: text("Request clarification", "Verduidelijking vragen"),
  } as Record<string, string>)[id] ?? id;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <aside className="modal portal-detail" role="dialog" aria-modal="true" aria-label={share.title}>
        <div className="portal-detail-head">
          <div>
            <span className="record-number">{share.record_code ?? label(recordTypeLabels, share.record_type, language)} · {label(recordTypeLabels, share.record_type, language)}</span>
            <h2>{share.title}</h2>
          </div>
          <button className="icon-button" type="button" aria-label={text("Close", "Sluiten")} onClick={close}><X size={18} /></button>
        </div>
        <dl className="portal-facts">
          <div><dt>{text("Status", "Status")}</dt><dd><ShareStatusBadge status={share.status} language={language} /></dd></div>
          <div><dt>{text("Requested", "Gevraagd")}</dt><dd>{label(requestedActionLabels, share.requested_action, language)}</dd></div>
          {share.due_at ? <div><dt>{text("Due", "Uiterlijk")}</dt><dd>{formatDate(share.due_at, locale, true)}{isOverdueShare(share) ? ` · ${text("overdue", "over tijd")}` : ""}</dd></div> : null}
          <div><dt>{text("Priority", "Prioriteit")}</dt><dd>{priorityText(share.priority, text)}</dd></div>
          {buildingName ? <div><dt>{text("Location", "Locatie")}</dt><dd>{buildingName}</dd></div> : null}
          <div><dt>{share.record_type === "publication" ? text("Published", "Gepubliceerd") : text("Assigned", "Toegewezen")}</dt><dd>{formatDate(share.assigned_at, locale, true)}</dd></div>
          {share.record_type === "publication" ? <div><dt>{text("Version", "Versie")}</dt><dd>v{share.publication_version}{share.status === "superseded" ? ` · ${text("superseded", "vervangen")}` : ` · ${text("current", "actueel")}`}</dd></div> : null}
          {share.round > 1 ? <div><dt>{text("Round", "Ronde")}</dt><dd>{share.round}</dd></div> : null}
        </dl>
        {share.visible_summary ? <p className="portal-summary">{share.visible_summary}</p> : null}
        {share.audience === "contractor" && share.requested_action === "acknowledge" ? (
          <p className="portal-note">{text("Acknowledging receipt confirms you received this item. It is not agreement on liability, cost or time.", "Ontvangst bevestigen betekent dat je dit item hebt ontvangen. Het is geen akkoord over aansprakelijkheid, kosten of tijd.")}</p>
        ) : null}
        {share.audience === "client" && share.requested_action === "approve" ? (
          <p className="portal-note">{text("Approval has only the effect agreed for this approval type. Acknowledging receipt is not approval.", "Goedkeuring heeft alleen het effect dat voor dit type is afgesproken. Ontvangst bevestigen is geen goedkeuring.")}</p>
        ) : null}

        {revisions.length ? (
          <section className="portal-detail-section">
            <h3>{text("Revisions", "Revisies")}</h3>
            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead><tr><th>{text("Revision", "Revisie")}</th><th>{text("Status", "Status")}</th><th>{text("Issue date", "Datum")}</th><th>{text("File", "Bestand")}</th></tr></thead>
                <tbody>
                  {revisions.map((revision) => {
                    const status = statusMeta(revision.review_status);
                    const available = files.some((item) => item.file_id === revision.file_id);
                    return (
                      <tr key={revision.id} className={revision.id === latestReleased ? "portal-current" : ""}>
                        <td>{revision.revision}{revision.id === latestReleased ? ` · ${text("latest released", "laatst vrijgegeven")}` : ""}</td>
                        <td><span className={toneClass[status.tone] ?? toneClass.neutral}>{language === "nl" ? status.nl : status.en}</span></td>
                        <td>{formatDate(revision.issue_date, locale)}</td>
                        <td>{available ? <button className="ui-button ui-button--secondary ui-button--sm" type="button" onClick={() => void download(revision.file_id)}><Download size={14} /> {text("Download", "Downloaden")}</button> : <small>{text("Not shared", "Niet gedeeld")}</small>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {!revisions.length && shared.length ? (
          <section className="portal-detail-section">
            <h3>{text("Files from CODECO", "Bestanden van CODECO")}</h3>
            <FileList files={shared.map((item) => snapshot.files.get(item.file_id)).filter(Boolean) as NonNullable<ReturnType<typeof snapshot.files.get>>[]} download={download} />
          </section>
        ) : null}
        {responses.length ? (
          <section className="portal-detail-section">
            <h3>{share.audience === "contractor" ? text("Your files", "Jouw bestanden") : text("Files", "Bestanden")}</h3>
            <FileList files={responses.map((item) => snapshot.files.get(item.file_id)).filter(Boolean) as NonNullable<ReturnType<typeof snapshot.files.get>>[]} download={download} />
          </section>
        ) : null}

        {steps.length ? (
          <section className="portal-detail-section portal-respond">
            <h3>{text("Your step", "Jouw stap")}</h3>
            <div className="portal-steps" role="group" aria-label={text("Your step", "Jouw stap")}>
              {steps.map((id) => (
                <button key={id} type="button" className={`ui-button ui-button--md ${step === id ? "ui-button--primary" : "ui-button--secondary"}`} aria-pressed={step === id} onClick={() => { setStep(id); setError(""); }}>
                  {id === "acknowledge" ? <CheckCircle2 size={15} /> : id === "comment" || id === "request_clarification" ? <MessageSquare size={15} /> : id === "submit_evidence" ? <Paperclip size={15} /> : <Send size={15} />}
                  {stepLabel(id)}
                </button>
              ))}
            </div>
            {step ? (
              <div className="portal-response-form">
                {fields.map((field) => (
                  <label key={field.key} className="form-field">
                    <span>{field.label}</span>
                    {field.type === "textarea"
                      ? <textarea rows={3} value={payload[field.key] ?? ""} onChange={(event) => setPayload((current) => ({ ...current, [field.key]: event.target.value }))} />
                      : <input type={field.type} value={payload[field.key] ?? ""} onChange={(event) => setPayload((current) => ({ ...current, [field.key]: event.target.value }))} />}
                  </label>
                ))}
                {step !== "acknowledge" ? (
                  <label className="form-field">
                    <span>{needsComment ? text("Comment (required)", "Opmerking (verplicht)") : text("Comment", "Opmerking")}</span>
                    <textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} />
                  </label>
                ) : null}
                {canUpload ? (
                  <div className="portal-upload">
                    <input ref={fileInput} className="visually-hidden" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => { void upload(event.currentTarget.files); event.currentTarget.value = ""; }} />
                    <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={progress !== null} onClick={() => fileInput.current?.click()}><Upload size={15} /> {text("Add file or photo", "Bestand of foto toevoegen")}</button>
                    {progress !== null ? <span role="status">{text("Uploading", "Uploaden")} {progress}%</span> : null}
                    {uploads.length ? <ul className="portal-upload-list">{uploads.map((item) => <li key={item.id}><Paperclip size={13} /> {item.name}</li>)}</ul> : null}
                  </div>
                ) : null}
                <div className="portal-response-actions">
                  <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={() => { setStep(""); setError(""); }}>{text("Cancel", "Annuleren")}</button>
                  <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || progress !== null} onClick={() => void submit()}>{busy ? <Loader2 className="spin" size={15} /> : <Send size={15} />} {stepLabel(step)}</button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
        {error ? <p className="field-warning" role="alert">{error}</p> : null}

        <section className="portal-detail-section">
          <h3><History size={15} /> {text("History", "Historie")}</h3>
          {rounds.map(({ round, events }) => (
            <div key={round} className="portal-round">
              {rounds.length > 1 ? <span className="portal-round-label">{text("Round", "Ronde")} {round}</span> : null}
              <ol className="portal-timeline">
                {events.map((event) => (
                  <li key={event.id}>
                    <strong>{label(eventLabels, event.action, language)}</strong>
                    <small>{event.actor_name ?? ""}{event.actor_side === "codeco" ? " · CODECO" : ""} · {formatDate(event.created_at, locale, true)}</small>
                    {event.comment ? <p>{event.comment}</p> : null}
                    {Object.keys(event.payload ?? {}).filter((key) => !["requested_action", "due_at", "priority", "publication_version"].includes(key)).length ? (
                      <dl className="portal-payload">
                        {Object.entries(event.payload).filter(([key]) => !["requested_action", "due_at", "priority", "publication_version"].includes(key)).map(([key, value]) => (
                          <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{String(value)}</dd></div>
                        ))}
                      </dl>
                    ) : null}
                    {event.file_ids?.length ? <small><Paperclip size={12} /> {event.file_ids.length} {text("file(s)", "bestand(en)")}</small> : null}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      </aside>
    </div>
  );
}

function FileList({ files, download }: { files: Array<{ id: string; original_name: string; mime_type: string; size_bytes: number }>; download: (id: string) => Promise<void> }) {
  const { text } = useLanguage();
  return (
    <ul className="portal-files">
      {files.map((file) => (
        <li key={file.id}>
          <span>{file.mime_type.startsWith("image/") ? <Camera size={14} /> : <FileText size={14} />} {file.original_name}</span>
          <button className="ui-button ui-button--secondary ui-button--sm" type="button" onClick={() => void download(file.id)}><Download size={14} /> {text("Download", "Downloaden")}</button>
        </li>
      ))}
    </ul>
  );
}
