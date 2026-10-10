"use client";

import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronDown,
  DatabaseBackup,
  HardDrive,
  Loader2,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useMemo, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { ensureDailyBackup } from "@/lib/backups/client";
import { downloadManualBackup, validateBackupDryRun, type BackupRun } from "@/lib/supabase/operations";

/** How old the newest verified backup may be before the screen stops calling it healthy. */
const backupStaleAfterHours = 30;
/** A restore that has never been rehearsed is a backup nobody has proven they can use. */
const restoreTestStaleAfterDays = 30;

type BackupScope = "project" | "organization";

function hoursSince(value: string | null | undefined) {
  if (!value) return null;
  const then = new Date(value).getTime();
  if (!Number.isFinite(then) || then > Date.now() + 60_000) return null;
  return (Date.now() - then) / 3_600_000;
}

function humanSize(bytes: number | null | undefined) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "3 hours ago" reads faster than a timestamp when the question is "is this current?". */
function ageLabel(value: string | null | undefined, dutch: boolean) {
  const hours = hoursSince(value);
  if (hours === null) return dutch ? "nooit" : "never";
  if (hours < 1) return dutch ? "minder dan een uur geleden" : "less than an hour ago";
  if (hours < 24) {
    const rounded = Math.round(hours);
    return dutch ? `${rounded} uur geleden` : `${rounded} hours ago`;
  }
  const days = Math.round(hours / 24);
  return dutch ? `${days} dag(en) geleden` : `${days} day(s) ago`;
}

function formatMoment(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const moment = new Date(value);
  if (Number.isNaN(moment.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Paramaribo" }).format(moment);
}

/**
 * What one backup actually holds, read straight off the run. A restore is a decision, and
 * nobody should have to make it from a file name and a checksum alone.
 */
function RecordCounts({ counts }: { counts: Record<string, number> | null | undefined }) {
  const { text } = useLanguage();
  const rows = Object.entries(counts ?? {})
    .filter(([, count]) => Number(count) > 0)
    .sort((left, right) => Number(right[1]) - Number(left[1]));
  if (!rows.length) return <p className="backup-empty">{text("This run did not record its contents.", "Deze run heeft zijn inhoud niet vastgelegd.")}</p>;
  const total = rows.reduce((sum, [, count]) => sum + Number(count), 0);
  return (
    <div className="backup-counts">
      <p>{text(`${total} records across ${rows.length} tables`, `${total} records verdeeld over ${rows.length} tabellen`)}</p>
      <div className="backup-counts-grid">
        {rows.map(([table, count]) => (
          <span key={table}><strong>{count}</strong><small>{table.replaceAll("_", " ")}</small></span>
        ))}
      </div>
    </div>
  );
}

export function BackupCenter({
  client,
  data,
  organizationId,
  projectId,
  projectName,
  canManageOrganization,
  isStorageGatewayConfigured,
  busy,
  run,
}: {
  client: SupabaseClient;
  data: { backupRuns: BackupRun[] };
  organizationId: string;
  projectId: string;
  projectName: string;
  canManageOrganization: boolean;
  isStorageGatewayConfigured: boolean;
  busy: boolean;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
}) {
  const { language, locale, text } = useLanguage();
  const dutch = language !== "en";
  const fileInput = useRef<HTMLInputElement>(null);
  const [scope, setScope] = useState<BackupScope>("project");
  const [historyFilter, setHistoryFilter] = useState<"all" | "scheduled" | "manual" | "restore_test">("all");
  const [openRunId, setOpenRunId] = useState("");
  const [lastExport, setLastExport] = useState<{ scope: BackupScope; size: number; sha256: string; counts: Record<string, number> } | null>(null);
  const [lastDryRun, setLastDryRun] = useState<BackupRun | null>(null);

  const runs = useMemo(() => [...data.backupRuns].sort((left, right) => String(right.created_at).localeCompare(String(left.created_at))), [data.backupRuns]);
  const scheduledAttempt = runs.find((item) => item.run_type === "scheduled");
  const latestScheduled = runs.find((item) => item.run_type === "scheduled" && item.status === "verified");
  const latestRestoreTest = runs.find((item) => item.run_type === "restore_test" && item.status === "dry_run_passed");
  const latestFailure = runs.find((item) => item.status === "failed");

  const scheduledAge = hoursSince(latestScheduled?.verified_at);
  const backupStale = scheduledAge === null || scheduledAge > backupStaleAfterHours || scheduledAttempt?.status === "failed";
  const restoreAge = hoursSince(latestRestoreTest?.verified_at);
  const restoreStale = restoreAge === null || restoreAge > restoreTestStaleAfterDays * 24;

  /** What is being kept right now, per tier, so the retention promise is checkable. */
  const heldCopies = useMemo(() => {
    const held = runs.filter((item) => item.status === "verified" && item.retention_tier);
    return {
      daily: held.filter((item) => item.retention_tier === "daily").length,
      weekly: held.filter((item) => item.retention_tier === "weekly").length,
      monthly: held.filter((item) => item.retention_tier === "monthly").length,
      // A database that has not run the retention migration reports no tier at all.
      unknown: runs.filter((item) => item.status === "verified" && item.retention_tier === undefined).length,
    };
  }, [runs]);

  const visibleRuns = historyFilter === "all" ? runs : runs.filter((item) => item.run_type === historyFilter);

  const statusLabel = (status: string) => ({
    verified: text("Verified", "Geverifieerd"),
    dry_run_passed: text("Restore test passed", "Hersteltest geslaagd"),
    failed: text("Failed", "Mislukt"),
    rotated: text("Rotated out", "Uitgerouleerd"),
    queued: text("Queued", "In wachtrij"),
    exporting: text("Exporting", "Exporteren"),
    uploading: text("Uploading", "Uploaden"),
    restored: text("Restored", "Hersteld"),
  } as Record<string, string>)[status] ?? status.replaceAll("_", " ");

  const typeLabel = (type: string) => ({
    scheduled: text("Automatic", "Automatisch"),
    manual: text("On request", "Op verzoek"),
    restore_test: text("Restore test", "Hersteltest"),
  } as Record<string, string>)[type] ?? type;

  return (
    <section className="operation-panel backup-center">
      {/* Three questions a continuity screen has to answer before anything else: is there a
          recent backup, has anyone proven it can be read back, and where does it live. */}
      <div className="backup-health">
        <article className={`backup-health-card ${backupStale ? "attention" : "healthy"}`}>
          <span>{backupStale ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}</span>
          <div>
            <strong>{text("Newest verified backup", "Nieuwste geverifieerde back-up")}</strong>
            <b>{ageLabel(latestScheduled?.verified_at, dutch)}</b>
            <small>{latestScheduled ? formatMoment(latestScheduled.verified_at, locale) : text("The daily job has not completed a run yet.", "De dagelijkse taak heeft nog geen run afgerond.")}</small>
          </div>
        </article>
        <article className={`backup-health-card ${restoreStale ? "attention" : "healthy"}`}>
          <span>{restoreStale ? <AlertTriangle size={20} /> : <ShieldCheck size={20} />}</span>
          <div>
            <strong>{text("Last restore validation", "Laatste herstelvalidatie")}</strong>
            <b>{ageLabel(latestRestoreTest?.verified_at, dutch)}</b>
            <small>{text("A validation checks the archive; a restore rehearsal in a separate environment is still required.", "Validatie controleert het archief; een hersteloefening in een aparte omgeving blijft vereist.")}</small>
          </div>
        </article>
        <article className={`backup-health-card ${isStorageGatewayConfigured && !backupStale ? "healthy" : "attention"}`}>
          <span><HardDrive size={20} /></span>
          <div>
            <strong>{text("Backup storage", "Back-upopslag")}</strong>
            <b>{isStorageGatewayConfigured ? text("Private and connected", "Privé en gekoppeld") : text("Not connected", "Niet gekoppeld")}</b>
          </div>
        </article>
      </div>

      {latestFailure ? (
        <div className="operation-alert error" role="alert">
          <AlertTriangle size={18} />
          <div>
            <strong>{text("The last run of this type failed", "De laatste run van dit type is mislukt")}</strong>
            <span>{latestFailure.error_summary || text("No reason was recorded. Run a backup by hand to see the current error.", "Er is geen reden vastgelegd. Draai een back-up met de hand om de actuele fout te zien.")}</span>
          </div>
        </div>
      ) : null}

      <div className="backup-workbench">
        <article className="backup-tool">
          <header><DatabaseBackup size={17} /><div><strong>{text("Take a backup now", "Nu een back-up maken")}</strong><small>{text("Same job as the nightly backup. Skipped if today's copy exists.", "Dezelfde taak als de nachtelijke back-up. Overgeslagen als de kopie van vandaag bestaat.")}</small></div></header>
          <button
            className="secondary-button"
            type="button"
            disabled={busy || !canManageOrganization}
            onClick={() => void run(
              () => ensureDailyBackup(client, organizationId),
              text("Backup finished.", "Back-up afgerond."),
            )}
          >
            {busy ? <Loader2 className="spin" size={15} /> : <DatabaseBackup size={15} />} {text("Run backup job", "Back-uptaak draaien")}
          </button>
        </article>

        <article className="backup-tool">
          <header><Archive size={17} /><div><strong>{text("Download a copy", "Een kopie downloaden")}</strong><small>{text("Download a checksummed copy.", "Download een kopie met controlesom.")}</small></div></header>
          <label className="form-field">
            <span>{text("What to include", "Wat meenemen")}</span>
            <select value={scope} onChange={(event) => setScope(event.target.value as BackupScope)}>
              <option value="project">{text(`This project only — ${projectName}`, `Alleen dit project — ${projectName}`)}</option>
              <option value="organization">{text("Every project, plus members, roles and settings", "Alle projecten, plus leden, rollen en instellingen")}</option>
            </select>
          </label>
          <button
            className="primary-button"
            type="button"
            disabled={busy || !canManageOrganization}
            onClick={() => void run(async () => {
              const result = await downloadManualBackup(client, organizationId, scope === "project" ? projectId : null);
              setLastExport({ scope, size: result.size, sha256: result.sha256, counts: result.recordCounts });
              return result;
            }, text("Backup downloaded and verified.", "Back-up gedownload en geverifieerd."))}
          >
            <DatabaseBackup size={15} /> {text("Download verified backup", "Download geverifieerde back-up")}
          </button>
        </article>

        <article className="backup-tool">
          <header><RotateCcw size={17} /><div><strong>{text("Test a backup file", "Een back-upbestand testen")}</strong><small>{text("Check a downloaded backup. Nothing is overwritten.", "Controleer een gedownloade back-up. Er wordt niets overschreven.")}</small></div></header>
          <button className="secondary-button" type="button" disabled={busy || !canManageOrganization} onClick={() => fileInput.current?.click()}>
            <RotateCcw size={15} /> {text("Choose a backup file", "Kies een back-upbestand")}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void run(async () => {
                  const result = await validateBackupDryRun(client, file);
                  setLastDryRun(result);
                  return result;
                }, text("Restore test passed; no data was overwritten.", "Hersteltest geslaagd; er is niets overschreven."));
              }
              event.target.value = "";
            }}
          />
        </article>
      </div>

      {lastExport ? (
        <article className="backup-result">
          <header><CheckCircle2 size={16} /> <strong>{text("Downloaded backup", "Gedownloade back-up")}</strong></header>
          <p>
            {lastExport.scope === "project" ? text("This project", "Dit project") : text("Whole organization", "Hele organisatie")}
            {" · "}{humanSize(lastExport.size)}{" · SHA-256 "}<code>{lastExport.sha256.slice(0, 16)}…</code>
          </p>
          <RecordCounts counts={lastExport.counts} />
        </article>
      ) : null}

      {lastDryRun ? (
        <article className="backup-result">
          <header><ShieldCheck size={16} /> <strong>{text("Restore test result", "Resultaat hersteltest")}</strong></header>
          <p>{text("The file is complete and belongs to this organization. Nothing was restored.", "Het bestand is compleet en hoort bij deze organisatie. Er is niets hersteld.")}</p>
          <RecordCounts counts={lastDryRun.record_counts} />
        </article>
      ) : null}

      <article className="backup-retention">
        <header><Archive size={16} /> <strong>{text("What is kept", "Wat wordt bewaard")}</strong></header>
        <p>{text("Automatic backups: 7 daily, 4 weekly, 3 monthly. Older copies are deleted on the next run.", "Automatische back-ups: 7 dagelijks, 4 wekelijks, 3 maandelijks. Oudere kopieën worden bij de volgende run verwijderd.")}</p>
        <div className="backup-retention-tiers">
          <span><strong>{heldCopies.daily}</strong><small>{text("of 7 daily", "van 7 dagelijks")}</small></span>
          <span><strong>{heldCopies.weekly}</strong><small>{text("of 4 weekly", "van 4 wekelijks")}</small></span>
          <span><strong>{heldCopies.monthly}</strong><small>{text("of 3 monthly", "van 3 maandelijks")}</small></span>
        </div>
        <small>{text("Keep a downloaded copy outside this application too.", "Bewaar ook een gedownloade kopie buiten deze applicatie.")}</small>
      </article>

      <article className="backup-history">
        <header>
          <strong>{text("Backup history", "Back-uphistorie")}</strong>
          <label className="form-field">
            <span>{text("Show", "Tonen")}</span>
            <select value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value as typeof historyFilter)}>
              <option value="all">{text(`Everything (${runs.length})`, `Alles (${runs.length})`)}</option>
              <option value="scheduled">{text("Automatic", "Automatisch")}</option>
              <option value="manual">{text("On request", "Op verzoek")}</option>
              <option value="restore_test">{text("Restore tests", "Hersteltests")}</option>
            </select>
          </label>
        </header>

        {visibleRuns.length ? (
          <div className="backup-history-list">
            {visibleRuns.map((item) => {
              const open = openRunId === item.id;
              return (
                <div className={`backup-history-row ${item.status}`} key={item.id}>
                  <button type="button" aria-expanded={open} onClick={() => setOpenRunId(open ? "" : item.id)}>
                    <span className="backup-history-when">
                      <strong>{formatMoment(item.verified_at ?? item.created_at, locale)}</strong>
                      <small>{typeLabel(item.run_type)} · {item.project_id ? text("one project", "één project") : text("whole organization", "hele organisatie")}</small>
                    </span>
                    <span className={`backup-history-status ${item.status}`}>{statusLabel(item.status)}</span>
                    <span className="backup-history-size">{humanSize(item.size_bytes)}</span>
                    {item.retention_tier ? <span className="backup-history-tier">{item.retention_tier}</span> : null}
                    <ChevronDown className={open ? "open" : ""} size={15} />
                  </button>
                  {open ? (
                    <div className="backup-history-detail">
                      <dl>
                        <div><dt>{text("Schema version", "Schemaversie")}</dt><dd>{item.schema_version}</dd></div>
                        <div><dt>SHA-256</dt><dd><code>{item.sha256 ? `${item.sha256.slice(0, 24)}…` : "—"}</code></dd></div>
                        <div><dt>{text("Started", "Gestart")}</dt><dd>{formatMoment(item.created_at, locale)}</dd></div>
                        <div><dt>{text("Verified", "Geverifieerd")}</dt><dd>{formatMoment(item.verified_at, locale)}</dd></div>
                      </dl>
                      {item.error_summary ? <p className="backup-history-error">{item.error_summary}</p> : null}
                      <RecordCounts counts={item.record_counts} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="backup-empty">{text("No run of this kind yet.", "Nog geen run van dit soort.")}</p>
        )}
      </article>

      {!canManageOrganization ? (
        <p className="backup-empty">{text("Only an administrator can run backups.", "Alleen een beheerder kan back-ups uitvoeren.")}</p>
      ) : null}
    </section>
  );
}
