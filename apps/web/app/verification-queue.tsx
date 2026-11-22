"use client";

import { Camera, CheckCircle2, ClipboardCheck, History, Loader2, MapPin, Search, ShieldCheck, X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { SectionNav } from "@/app/section-nav";
import { useLanguage } from "@/lib/i18n";
import { useBackToClose } from "@/lib/navigation/app-history";
import { useProjectPermissions } from "@/lib/permissions/project-permissions";
import { locateCoordinates } from "@/lib/browser/geolocation";
import { uploadProjectFile } from "@/lib/storage/gateway";
import { loadPortalSnapshot, loadRecordFiles } from "@/lib/portal/portal-data";
import { buildVerificationQueue, verificationResultLabels } from "@/lib/verification/verification-model.mjs";
import type { OperationSnapshot } from "@/lib/supabase/operations";
import { statusText } from "@/lib/status-labels";

type QueueItem = {
  key: string;
  kind: "work" | "ncr" | "action" | "inspection" | "evidence";
  recordType: "finding" | "action" | "inspection" | "register_entry" | "portal_share";
  recordId: string;
  code: string;
  title: string;
  status: string;
  buildingId: string | null;
  partyId: string | null;
  since: string | null;
  sourceRecordType?: string;
  sourceRecordId?: string;
};

type Verification = {
  id: string; record_type: string; record_id: string; record_code: string | null; result: string; comment: string | null;
  file_ids: string[]; location_label: string | null; latitude: number | null; longitude: number | null; previous_status: string | null;
  resulting_status: string | null; follow_up_action_id: string | null; verified_by: string; verified_at: string;
};

const toneClass: Record<string, string> = {
  pass: "ui-status-badge ui-status-badge--green",
  partial: "ui-status-badge ui-status-badge--amber",
  further_action: "ui-status-badge ui-status-badge--amber",
  fail: "ui-status-badge ui-status-badge--red",
};

function when(value: string | null | undefined, locale: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Paramaribo" });
}

async function loadVerifications(client: SupabaseClient, projectId: string) {
  const [verifications, people] = await Promise.all([
    client.from("verifications").select("*").eq("project_id", projectId).order("verified_at", { ascending: false }).limit(1000),
    client.rpc("list_project_people", { p_project_id: projectId }),
  ]);
  if (verifications.error) throw verifications.error;
  return {
    verifications: (verifications.data ?? []) as Verification[],
    names: new Map(((people.data ?? []) as Array<{ user_id: string; display_name: string }>).map((person) => [person.user_id, person.display_name])),
  };
}

/** The result of earlier verifications of one record, for its own screen (section 10: "keep the result in the record's history"). */
export function RecordVerifications({ client, projectId, recordType, recordId }: { client: SupabaseClient; projectId: string; recordType: string; recordId: string }) {
  const { language, locale, text } = useLanguage();
  const query = useQuery({ queryKey: ["verifications", projectId], queryFn: () => loadVerifications(client, projectId), staleTime: 30_000 });
  const rows = (query.data?.verifications ?? []).filter((row) => row.record_type === recordType && row.record_id === recordId);
  if (!rows.length) return null;
  return (
    <section className="verification-history" aria-label={text("Verification history", "Verificatiehistorie")}>
      <h3><ShieldCheck size={15} /> {text("Verification history", "Verificatiehistorie")}</h3>
      <ol className="portal-timeline">
        {rows.map((row) => (
          <li key={row.id}>
            <span><span className={toneClass[row.result] ?? "ui-status-badge"}>{verificationResultLabels[row.result as keyof typeof verificationResultLabels]?.[language] ?? row.result}</span></span>
            <small>{query.data?.names.get(row.verified_by) ?? ""} · {when(row.verified_at, locale)}{row.location_label ? ` · ${row.location_label}` : ""}</small>
            {row.comment ? <p>{row.comment}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Rapid Verify (section 10 and the client's menu): one queue of everything that waits for a
 * supervisor's verification on site, a quick result per item, and the verification history. The
 * search through project documents stays as its own view.
 */
export function VerificationWorkspace({
  client,
  projectId,
  data,
  actions,
  buildings,
  parties,
  specSearch,
  openRecord,
}: {
  client: SupabaseClient;
  projectId: string;
  data: OperationSnapshot;
  actions: Array<{ id: string; title: string; action_number: string; status: string; due_at: string | null; source_type?: string | null; source_id?: string | null }>;
  buildings: Array<{ id: string; name: string }>;
  parties: Array<{ id: string; name: string; type: string }>;
  specSearch: ReactNode;
  openRecord?: (recordType: string, recordId: string) => void;
}) {
  const { language, locale, text } = useLanguage();
  const permissions = useProjectPermissions();
  const [section, setSection] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const portalQuery = useQuery({
    queryKey: ["portal-register", projectId],
    queryFn: () => loadPortalSnapshot(client, projectId),
    enabled: permissions.canAny("portal.share", "records.edit"),
  });
  const historyQuery = useQuery({ queryKey: ["verifications", projectId], queryFn: () => loadVerifications(client, projectId) });

  const queue = useMemo(() => buildVerificationQueue({
    findings: data.findings,
    inspections: data.inspections,
    registerEntries: data.registerEntries,
    actions,
    shares: portalQuery.data?.shares ?? [],
  }) as Record<"work" | "ncr" | "action" | "inspection" | "evidence" | "all", QueueItem[]>, [actions, data.findings, data.inspections, data.registerEntries, portalQuery.data?.shares]);

  const buildingName = (id: string | null) => buildings.find((item) => item.id === id)?.name ?? "";
  const partyName = (id: string | null) => parties.find((item) => item.id === id)?.name ?? "";
  const canVerify = (item: QueueItem) => item.recordType === "finding" ? permissions.can("findings.verify")
    : item.recordType === "action" ? permissions.can("actions.manage")
      : item.recordType === "inspection" ? permissions.can("inspections.manage")
        : item.recordType === "portal_share" ? permissions.can("portal.share")
          : permissions.can("records.edit");
  const needle = search.trim().toLowerCase();
  const filter = (items: QueueItem[]) => items.filter((item) => !needle || `${item.code} ${item.title} ${buildingName(item.buildingId)} ${partyName(item.partyId)}`.toLowerCase().includes(needle));
  const history = (historyQuery.data?.verifications ?? []).filter((row) => !needle || `${row.record_code ?? ""} ${row.comment ?? ""}`.toLowerCase().includes(needle));
  const today = new Date().toISOString().slice(0, 10);

  const sections = [
    { id: "dashboard", label: text("Verification dashboard", "Verificatiedashboard"), count: queue.all.length },
    { id: "work", label: text("Work verification", "Werkverificatie"), count: queue.work.length },
    { id: "ncr", label: text("NCR verification", "NCR-verificatie"), count: queue.ncr.length },
    { id: "action", label: text("Action verification", "Actieverificatie"), count: queue.action.length },
    { id: "inspection", label: text("Inspection follow-up", "Inspectie-opvolging"), count: queue.inspection.length },
    { id: "evidence", label: text("Evidence review", "Bewijs beoordelen"), count: queue.evidence.length },
    { id: "pending", label: text("Pending verification", "Wacht op verificatie"), count: queue.all.length },
    { id: "history", label: text("Verification history", "Verificatiehistorie"), count: historyQuery.data?.verifications.length },
    { id: "specs", label: text("Check against specs", "Toetsen aan specificaties") },
  ];

  const list = (items: QueueItem[], empty: string) => {
    const shown = filter(items);
    return shown.length ? (
      <div className="portal-list">
        {shown.map((item) => (
          <div key={item.key} className="ui-list-row verification-row">
            <span className="portal-row-main">
              <span className="ui-list-row__code">{item.code} · {({ work: text("Work", "Werk"), ncr: "NCR / issue", action: text("Action", "Actie"), inspection: text("Inspection", "Inspectie"), evidence: text("Contractor evidence", "Bewijs aannemer") } as Record<string, string>)[item.kind]}</span>
              <span className="ui-list-row__title">{item.title}</span>
              <span className="ui-list-row__meta">{[statusText(item.status, text), buildingName(item.buildingId), partyName(item.partyId), item.since ? when(item.since, locale) : ""].filter(Boolean).join(" · ")}</span>
            </span>
            <span className="portal-row-side">
              {openRecord && item.recordType !== "portal_share" ? <button className="ui-button ui-button--quiet ui-button--sm" type="button" onClick={() => openRecord(item.recordType, item.recordId)}>{text("Open record", "Record openen")}</button> : null}
              {canVerify(item) ? <button className="ui-button ui-button--primary ui-button--sm" type="button" onClick={() => setOpenKey(item.key)}><ClipboardCheck size={14} /> {text("Verify", "Verifiëren")}</button> : null}
            </span>
          </div>
        ))}
      </div>
    ) : <p className="record-list-empty">{empty}</p>;
  };

  let body: ReactNode;
  if (section === "specs") body = specSearch;
  else if (section === "history" ? historyQuery.isLoading : portalQuery.isLoading || (section === "dashboard" && historyQuery.isLoading)) {
    body = <p className="portal-loading" role="status"><Loader2 className="spin" size={16} /> {text("Loading verification…", "Verificatie laden…")}</p>;
  }
  else if (section === "history") {
    body = (
      <section className="ui-panel">
        <div className="ui-panel__heading"><h2>{text("Verification history", "Verificatiehistorie")}</h2></div>
        {history.length ? (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>{text("When", "Wanneer")}</th><th>{text("Record", "Record")}</th><th>{text("Result", "Resultaat")}</th><th>{text("Verifier", "Verificateur")}</th><th>{text("Location", "Locatie")}</th><th>{text("Comment", "Opmerking")}</th></tr></thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td>{when(row.verified_at, locale)}</td>
                    <td>{row.record_code ?? ""}<small className="portal-cell-meta">{row.previous_status && row.resulting_status && row.previous_status !== row.resulting_status ? `${statusText(row.previous_status, text)} → ${statusText(row.resulting_status, text)}` : ""}</small></td>
                    <td><span className={toneClass[row.result] ?? "ui-status-badge"}>{verificationResultLabels[row.result as keyof typeof verificationResultLabels]?.[language] ?? row.result}</span>{row.follow_up_action_id ? <small className="portal-cell-meta">{text("Follow-up action created", "Vervolgactie aangemaakt")}</small> : null}</td>
                    <td>{historyQuery.data?.names.get(row.verified_by) ?? ""}</td>
                    <td>{row.location_label ?? (row.latitude ? `${row.latitude}, ${row.longitude}` : "")}</td>
                    <td>{row.comment ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="record-list-empty">{text("No verifications recorded yet.", "Nog geen verificaties vastgelegd.")}</p>}
      </section>
    );
  } else if (section === "dashboard") {
    const done = historyQuery.data?.verifications ?? [];
    const todayDone = done.filter((row) => row.verified_at.slice(0, 10) === today);
    body = (
      <>
        <div className="portal-stats" role="list">
          <div className="ui-stat portal-stat" role="listitem"><span className="ui-stat__value">{queue.all.length}</span><span className="ui-stat__label">{text("Waiting for verification", "Wacht op verificatie")}</span></div>
          <div className="ui-stat portal-stat" role="listitem"><span className="ui-stat__value">{queue.ncr.length}</span><span className="ui-stat__label">{text("NCRs to verify", "NCR's te verifiëren")}</span></div>
          <div className="ui-stat portal-stat" role="listitem"><span className="ui-stat__value">{todayDone.length}</span><span className="ui-stat__label">{text("Verified today", "Vandaag geverifieerd")}</span></div>
          <div className={`ui-stat portal-stat${done.filter((row) => row.result !== "pass").length ? " portal-stat--amber" : ""}`} role="listitem"><span className="ui-stat__value">{done.filter((row) => row.result !== "pass").length}</span><span className="ui-stat__label">{text("Not accepted (all time)", "Niet geaccepteerd (totaal)")}</span></div>
        </div>
        <section className="ui-panel"><div className="ui-panel__heading"><h2>{text("Waiting for verification", "Wacht op verificatie")}</h2></div>{list(queue.all.slice(0, 10), text("Nothing is waiting for verification.", "Er wacht niets op verificatie."))}</section>
      </>
    );
  } else {
    const items = section === "pending" ? queue.all : queue[section as "work" | "ncr" | "action" | "inspection" | "evidence"];
    body = <section className="ui-panel"><div className="ui-panel__heading"><h2>{sections.find((item) => item.id === section)?.label}</h2></div>{list(items, text("Nothing is waiting here.", "Hier wacht niets."))}</section>;
  }

  const openItem = queue.all.find((item) => item.key === openKey) ?? null;
  return (
    <section className="verification-workspace">
      {/* The source check carries its own "Rapid Verify" heading. */}
      <header className="secondary-header ui-page-header">{section !== "specs" ? <div><h1>Rapid Verify</h1></div> : null}
        {section !== "specs" ? <label className="document-register-search"><Search size={15} /><span className="sr-only">{text("Search", "Zoeken")}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text("Code, title, location or company", "Code, titel, locatie of bedrijf")} /></label> : null}
      </header>
      <SectionNav label={text("Rapid Verify sections", "Rapid Verify-onderdelen")} items={sections.map((item) => ({ id: item.id, label: item.label, count: item.count, selected: section === item.id, onSelect: () => setSection(item.id) }))} />
      <div className="portal-section">{body}</div>
      {openItem ? <VerifyDialog client={client} projectId={projectId} item={openItem} buildingName={buildingName(openItem.buildingId)} defaultBuildingId={openItem.buildingId ?? buildings[0]?.id ?? ""} parties={parties} close={() => setOpenKey(null)} /> : null}
    </section>
  );
}

function VerifyDialog({ client, projectId, item, buildingName, defaultBuildingId, parties, close }: {
  client: SupabaseClient; projectId: string; item: QueueItem; buildingName: string; defaultBuildingId: string;
  parties: Array<{ id: string; name: string; type: string }>; close: () => void;
}) {
  const { language, text } = useLanguage();
  const permissions = useProjectPermissions();
  const queryClient = useQueryClient();
  useBackToClose(true, close);
  const [result, setResult] = useState<"pass" | "partial" | "fail" | "further_action" | "">("");
  const [comment, setComment] = useState("");
  const [locationLabel, setLocationLabel] = useState(buildingName);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [photos, setPhotos] = useState<Array<{ id: string; name: string }>>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [followUp, setFollowUp] = useState({ create: false, title: "", due: "", priority: "normal", party: item.partyId ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement | null>(null);
  const evidence = useQuery({
    queryKey: ["verify-evidence", item.key],
    queryFn: async () => {
      if (item.recordType === "portal_share") {
        const snapshot = await loadPortalSnapshot(client, projectId, { recordType: item.sourceRecordType, recordId: item.sourceRecordId });
        const share = snapshot.shares.find((row) => row.id === item.recordId);
        const files = snapshot.shareFiles.filter((row) => row.share_id === item.recordId && row.source === "response").map((row) => snapshot.files.get(row.file_id)).filter(Boolean);
        const last = snapshot.events.filter((event) => event.share_id === item.recordId && event.actor_side === "contractor").at(-1);
        return { files: files as Array<{ id: string; original_name: string }>, note: last?.comment ?? share?.visible_summary ?? "" };
      }
      const files = await loadRecordFiles(client, projectId, item.recordType === "finding" ? "finding" : item.recordType, item.recordId);
      return { files: files as Array<{ id: string; original_name: string }>, note: "" };
    },
  });
  const canFollowUp = permissions.can("actions.manage");

  const locate = async () => {
    setError("");
    try {
      const controller = new AbortController();
      setCoordinates(await locateCoordinates(controller.signal));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };
  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        setProgress(0);
        const uploaded = await uploadProjectFile(client, { projectId, buildingId: defaultBuildingId, category: "evidence", file, onProgress: setProgress });
        setPhotos((current) => [...current, { id: uploaded.fileId, name: file.name }]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setProgress(null);
      }
    }
  };
  const save = async () => {
    if (!result) { setError(text("Choose the result.", "Kies het resultaat.")); return; }
    if (result !== "pass" && comment.trim().length < 3) { setError(text("Describe what is not in order.", "Beschrijf wat niet in orde is.")); return; }
    setBusy(true); setError("");
    try {
      const response = await client.rpc("record_verification", {
        p_project_id: projectId, p_record_type: item.recordType, p_record_id: item.recordId, p_result: result, p_comment: comment,
        p_file_ids: photos.map((photo) => photo.id), p_latitude: coordinates?.latitude ?? null, p_longitude: coordinates?.longitude ?? null,
        p_location_label: locationLabel,
        p_follow_up: result !== "pass" && followUp.create && followUp.title.trim()
          ? { title: followUp.title.trim(), due_at: followUp.due ? new Date(`${followUp.due}T17:00:00-03:00`).toISOString() : null, priority: followUp.priority, owner_party_id: followUp.party || null }
          : null,
      });
      if (response.error) throw response.error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["verifications", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["portal-register", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["project-operations", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["project-day"] }),
      ]);
      close();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String((caught as { message?: string })?.message ?? caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <aside className="modal portal-detail" role="dialog" aria-modal="true" aria-label={`${text("Verify", "Verifiëren")} ${item.code}`}>
        <div className="portal-detail-head">
          <div><span className="record-number">{item.code}</span><h2>{item.title}</h2></div>
          <button className="icon-button" type="button" aria-label={text("Close", "Sluiten")} onClick={close}><X size={18} /></button>
        </div>
        <dl className="portal-facts">
          <div><dt>{text("Status", "Status")}</dt><dd>{statusText(item.status, text)}</dd></div>
          {buildingName ? <div><dt>{text("Location", "Locatie")}</dt><dd>{buildingName}</dd></div> : null}
        </dl>
        {evidence.data?.note ? <p className="portal-summary">{evidence.data.note}</p> : null}
        {evidence.data?.files.length ? (
          <section className="portal-detail-section"><h3>{text("Evidence", "Bewijs")}</h3>
            <ul className="portal-files">{evidence.data.files.map((file) => <li key={file.id}><span><Camera size={14} /> {file.original_name}</span></li>)}</ul>
          </section>
        ) : null}
        <section className="portal-detail-section">
          <h3>{text("Result", "Resultaat")}</h3>
          <div className="portal-steps" role="radiogroup" aria-label={text("Result", "Resultaat")}>
            {(["pass", "partial", "further_action", "fail"] as const).map((id) => (
              <button key={id} type="button" role="radio" aria-checked={result === id} className={`ui-button ui-button--md ${result === id ? "ui-button--primary" : "ui-button--secondary"}`} onClick={() => setResult(id)}>
                {id === "pass" ? <CheckCircle2 size={15} /> : null}{verificationResultLabels[id][language]}
              </button>
            ))}
          </div>
          <label className="form-field"><span>{result && result !== "pass" ? text("What is not in order (required)", "Wat is niet in orde (verplicht)") : text("Comment", "Opmerking")}</span><textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} /></label>
          <div className="form-grid form-grid-2">
            <label className="form-field"><span>{text("Location on site", "Locatie op de bouwplaats")}</span><input value={locationLabel} maxLength={240} onChange={(event) => setLocationLabel(event.target.value)} /></label>
            <div className="form-field"><span>{text("GPS", "GPS")}</span>
              <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => void locate()}><MapPin size={15} /> {coordinates ? `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}` : text("Record my location", "Mijn locatie vastleggen")}</button>
            </div>
          </div>
          <div className="portal-upload">
            <input ref={input} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={(event) => { void addPhotos(event.currentTarget.files); event.currentTarget.value = ""; }} />
            <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={progress !== null} onClick={() => input.current?.click()}><Camera size={15} /> {text("Add photo", "Foto toevoegen")}</button>
            {progress !== null ? <span role="status">{text("Uploading", "Uploaden")} {progress}%</span> : null}
            {photos.length ? <ul className="portal-upload-list">{photos.map((photo) => <li key={photo.id}><Camera size={13} /> {photo.name}</li>)}</ul> : null}
          </div>
          {result && result !== "pass" && canFollowUp ? (
            <fieldset className="portal-file-choice">
              <legend>{text("Follow-up action", "Vervolgactie")}</legend>
              <label className="portal-check"><input type="checkbox" checked={followUp.create} onChange={(event) => setFollowUp((current) => ({ ...current, create: event.target.checked, title: current.title || `${text("Correct", "Herstellen")}: ${item.title}`.slice(0, 200) }))} /><span>{text("Create a linked action", "Gekoppelde actie aanmaken")}</span></label>
              {followUp.create ? (
                <div className="form-grid form-grid-2">
                  <label className="form-field"><span>{text("Action", "Actie")}</span><input value={followUp.title} maxLength={200} onChange={(event) => setFollowUp((current) => ({ ...current, title: event.target.value }))} /></label>
                  <label className="form-field"><span>{text("Responsible party", "Verantwoordelijke partij")}</span>
                    <select value={followUp.party} onChange={(event) => setFollowUp((current) => ({ ...current, party: event.target.value }))}><option value="">{text("Not assigned", "Niet toegewezen")}</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select>
                  </label>
                  <label className="form-field"><span>{text("Due", "Uiterlijk")}</span><input type="date" value={followUp.due} onChange={(event) => setFollowUp((current) => ({ ...current, due: event.target.value }))} /></label>
                  <label className="form-field"><span>{text("Priority", "Prioriteit")}</span>
                    <select value={followUp.priority} onChange={(event) => setFollowUp((current) => ({ ...current, priority: event.target.value }))}>
                      <option value="low">{text("Low", "Laag")}</option><option value="normal">{text("Normal", "Normaal")}</option><option value="high">{text("High", "Hoog")}</option><option value="critical">{text("Critical", "Kritiek")}</option>
                    </select>
                  </label>
                </div>
              ) : null}
            </fieldset>
          ) : null}
        </section>
        {error ? <p className="field-warning" role="alert">{error}</p> : null}
        <div className="portal-response-actions">
          <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={close}>{text("Cancel", "Annuleren")}</button>
          <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || progress !== null} onClick={() => void save()}>{busy ? <Loader2 className="spin" size={15} /> : <History size={15} />} {text("Record verification", "Verificatie vastleggen")}</button>
        </div>
      </aside>
    </div>
  );
}

/** Corrective, preventive or follow-up (section 9 and the menu). Set by an action manager. */
export function ActionCategoryField({ client, actionId, value, changed }: { client: SupabaseClient; actionId: string; value: string | null | undefined; changed: () => void }) {
  const { text } = useLanguage();
  const permissions = useProjectPermissions();
  const [current, setCurrent] = useState(value ?? "follow_up");
  const [error, setError] = useState("");
  const labels: Record<string, string> = {
    corrective: text("Corrective action", "Corrigerende actie"),
    preventive: text("Preventive action", "Preventieve actie"),
    follow_up: text("Follow-up action", "Vervolgactie"),
  };
  if (!permissions.can("actions.manage")) return <p className="portal-note">{labels[current] ?? current}</p>;
  return (
    <label className="form-field action-category-field"><span>{text("Kind of action", "Soort actie")}</span>
      <select value={current} onChange={async (event) => {
        const next = event.target.value;
        setError("");
        const result = await client.rpc("set_project_action_category", { p_action_id: actionId, p_category: next });
        if (result.error) { setError(result.error.message); return; }
        setCurrent(next);
        changed();
      }}>
        {Object.entries(labels).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}
