import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, Building2, CalendarDays, CheckCircle2 } from "lucide-react";
import { normalizeExternalShareToken } from "@/lib/external-share/token.mjs";
import { createStorageAdminClient } from "@/lib/storage/server";
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
      <section className="external-share-card">
        <header><span className="external-share-brand">CODECO N.V. · SUPERVISIE</span><span className={`external-share-status ${record.severity ?? ""}`}>{record.status?.replaceAll("_", " ") ?? "open"}</span></header>
        <div className="external-share-context"><Building2 size={18} /><span><strong>{record.project_code} · {record.project_name}</strong><small>{record.building_name ?? "Projectbreed"}</small></span></div>
        <span className="record-number">{record.source_type.toUpperCase()} · {record.source_number}</span>
        <h1>{record.title}</h1>
        {record.has_source_image ? (
          <ExternalSourceImage token={token} sourceNumber={record.source_number} />
        ) : null}
        <p>{record.summary}</p>
        <div className="external-share-meta"><span><AlertTriangle size={16} /><b>Prioriteit</b>{record.severity ?? "normaal"}</span><span><CalendarDays size={16} /><b>Deadline</b>{date(record.due_at)}</span></div>
        <ExternalShareActions token={token} sourceType={record.source_type} status={record.status} />
        <footer><CheckCircle2 size={16} /><span>Deze beveiligde link vervalt op {date(record.expires_at)}. Er is geen CODECO-account nodig; CODECO verifieert iedere gereedmelding.</span></footer>
      </section>
    </main>
  );
}
