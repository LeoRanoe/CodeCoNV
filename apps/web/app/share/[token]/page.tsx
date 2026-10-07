import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, Building2, CalendarDays, CheckCircle2 } from "lucide-react";
import { normalizeExternalShareToken } from "@/lib/external-share/token.mjs";
import { createStorageAdminClient } from "@/lib/storage/server";
import { actionStatusLabels, findingStatusLabels, labelFor, severityLabels } from "@/lib/status-labels";
import { DocumentLanguage } from "../../document-language";
import { ExternalShareActions, ExternalSourceImage } from "./external-share-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gedeeld projectpunt", robots: { index: false, follow: false } };

type SharedRecord = {
  project_name: string;
  project_code: string;
  building_name: string | null;
  source_type: string;
  source_number: string;
  title: string;
  summary: string;
  status: string | null;
  severity: string | null;
  due_at: string | null;
  expires_at: string;
  has_source_image: boolean;
  response_count: number;
  /** Present once the database knows the contractor's box on the NCR form. */
  record_kind?: string | null;
  recommended_action?: string | null;
  recommended_action_detail?: string | null;
  proposed_correction?: string | null;
};

const recommendedActionLabels: Record<string, string> = {
  rework: "Opnieuw uitvoeren",
  repair: "Herstellen",
  alternative: "Alternatieve oplossing ter goedkeuring",
};

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("nl-SR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(value)) : "Geen deadline";
}

export default async function SharedProjectRecord({ params }: { params: Promise<{ token: string }> }) {
  const route = await params;
  const token = normalizeExternalShareToken(route.token);
  if (!token) notFound();
  const result = await createStorageAdminClient().rpc("resolve_external_share_link", { p_token: token });
  if (result.error || !result.data) notFound();
  const record = result.data as SharedRecord;
  return (
    <main className="external-share-shell">
      <DocumentLanguage fixed="nl" />
      <section className="external-share-card">
        <header><span className="external-share-brand">CODECO N.V. · SUPERVISIE</span><span className={`external-share-status ${record.severity ?? ""}`}>{labelFor(record.source_type === "action" ? actionStatusLabels : findingStatusLabels, record.status, "nl", "Open")}</span></header>
        <div className="external-share-context"><Building2 size={18} /><span><strong>{record.project_code} · {record.project_name}</strong><small>{record.building_name ?? "Projectbreed"}</small></span></div>
        <span className="record-number">{record.source_type.toUpperCase()} · {record.source_number}</span>
        <h1>{record.title}</h1>
        {record.has_source_image ? (
          <ExternalSourceImage token={token} sourceNumber={record.source_number} />
        ) : null}
        <p>{record.summary}</p>
        <div className="external-share-meta"><span><AlertTriangle size={16} /><b>Prioriteit</b>{labelFor(severityLabels, record.severity, "nl", "Normaal")}</span><span><CalendarDays size={16} /><b>Deadline</b>{date(record.due_at)}</span></div>
        {/* An NCR asks the contractor for something specific, so the link shows what the
            engineer recommended before it asks for the corrective action. */}
        {record.record_kind === "ncr" ? (
          <section className="external-ncr-instruction">
            <span>Aanbevolen actie door de ingenieur</span>
            <strong>{recommendedActionLabels[record.recommended_action ?? ""] ?? "Zie omschrijving"}</strong>
            {record.recommended_action_detail ? <p>{record.recommended_action_detail}</p> : null}
            {record.proposed_correction ? <small>Eerder ontvangen voorstel: {record.proposed_correction}</small> : null}
          </section>
        ) : null}
        <ExternalShareActions token={token} sourceType={record.source_type} status={record.status} recordKind={record.record_kind ?? null} />
        <footer><CheckCircle2 size={16} /><span>Deze beveiligde link vervalt op {date(record.expires_at)}. Er is geen CODECO-account nodig; CODECO verifieert iedere gereedmelding.</span></footer>
      </section>
    </main>
  );
}
