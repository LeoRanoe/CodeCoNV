"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlertTriangle,
  CheckCircle2,
  CloudDownload,
  HardDrive,
  Loader2,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { useBackToClose } from "@/lib/navigation/app-history";
import {
  clearOfflineCopy,
  offlineStorageUsage,
  readOfflineSyncSummary,
  syncEverythingForOffline,
  type OfflineSyncProgress,
  type OfflineSyncSummary,
} from "@/lib/offline/full-sync";

function humanSize(bytes: number) {
  if (!bytes) return "0 MB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Making the whole project available on the device, on purpose and before leaving. The app
 * already keeps whatever was opened while online; this is the difference between "probably
 * enough" and "everything this account can read is on this phone".
 */
export function OfflineManagerModal({
  client,
  userId,
  isOnline,
  close,
}: {
  client: SupabaseClient;
  userId: string;
  isOnline: boolean;
  close: () => void;
}) {
  const { locale, text } = useLanguage();
  useBackToClose(true, close);
  const [summary, setSummary] = useState<OfflineSyncSummary | null>(null);
  const [usage, setUsage] = useState({ files: 0, bytes: 0, quotaBytes: 0, usedBytes: 0 });
  const [progress, setProgress] = useState<OfflineSyncProgress | null>(null);
  const [includeFiles, setIncludeFiles] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    const [stored, used] = await Promise.all([readOfflineSyncSummary(), offlineStorageUsage()]);
    setSummary(stored);
    setUsage(used);
  }, []);

  useEffect(() => {
    // Reading the device's own storage is an external system, not React state derived from
    // props; it is started after the first paint so the dialog opens immediately.
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [refresh]);

  const start = async () => {
    setError("");
    setNotice("");
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ step: "workspace", projectName: "", completed: 0, total: 1, bytes: 0 });
    try {
      const result = await syncEverythingForOffline(client, {
        userId,
        includeFiles,
        signal: controller.signal,
        onProgress: setProgress,
      });
      setSummary(result);
      setNotice(result.skippedFiles
        ? text(
          `Everything is on this device. ${result.skippedFiles} file(s) could not be fetched; their records are complete.`,
          `Alles staat op dit apparaat. ${result.skippedFiles} bestand(en) konden niet worden opgehaald; hun registraties zijn wel volledig.`,
        )
        : text("Everything this account can read is now on this device.", "Alles wat dit account mag inzien staat nu op dit apparaat."));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      setError(message === "offline-sync-cancelled"
        ? text("Stopped. What was already downloaded stays available.", "Gestopt. Wat al is opgehaald blijft beschikbaar.")
        : text(
          "The offline copy is incomplete. Check the connection and start again; what was downloaded stays available.",
          "De offline kopie is niet compleet. Controleer de verbinding en start opnieuw; wat is opgehaald blijft beschikbaar.",
        ));
    } finally {
      abortRef.current = null;
      setProgress(null);
      await refresh();
    }
  };

  const busy = Boolean(progress);
  const stepLabel = (() => {
    if (!progress) return "";
    if (progress.step === "workspace") return text("Reading your projects…", "Je projecten ophalen…");
    if (progress.step === "files") return text(`Photos and drawings · ${progress.projectName} · ${progress.completed}/${progress.total}`, `Foto’s en tekeningen · ${progress.projectName} · ${progress.completed}/${progress.total}`);
    if (progress.step === "code") return text("Storing the parts of the app that load on demand…", "De onderdelen van de app die pas bij gebruik laden opslaan…");
    if (progress.step === "done") return text("Done", "Klaar");
    return text(`Project ${progress.completed + 1} of ${progress.total} · ${progress.projectName}`, `Project ${progress.completed + 1} van ${progress.total} · ${progress.projectName}`);
  })();
  const percent = progress && progress.total > 0 ? Math.min(100, Math.round((progress.completed / progress.total) * 100)) : 0;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && close()}>
      <section className="modal offline-manager-modal" role="dialog" aria-modal="true" aria-labelledby="offline-manager-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">{text("Working without a connection", "Werken zonder verbinding")}</p>
            <h2 id="offline-manager-title">{text("Offline availability", "Offline beschikbaarheid")}</h2>
            <p>{text(
              "The installed app opens and keeps working without internet. Everything you opened while online stays available; this puts all of it on the device in one go.",
              "De geïnstalleerde app opent en blijft werken zonder internet. Alles wat je online hebt geopend blijft beschikbaar; hiermee zet je het in één keer helemaal op het apparaat.",
            )}</p>
          </div>
          <button className="modal-close" type="button" onClick={close} disabled={busy} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>

        <div className="modal-body offline-manager-body">
          <div className={`offline-manager-state ${summary ? "ready" : "empty"}`}>
            <span>{summary ? <CheckCircle2 size={20} /> : <HardDrive size={20} />}</span>
            <div>
              <strong>{summary
                ? text(`${summary.projects} project(s) available offline`, `${summary.projects} project(en) offline beschikbaar`)
                : text("Not yet fully downloaded", "Nog niet volledig opgehaald")}</strong>
              <small>{summary
                ? text(
                  `Last complete download ${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(summary.finishedAt))} · ${usage.files} files · ${humanSize(usage.bytes)}`,
                  `Laatste volledige ophaal ${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(summary.finishedAt))} · ${usage.files} bestanden · ${humanSize(usage.bytes)}`,
                )
                : text(
                  "Only what you opened while online is on this device right now.",
                  "Op dit moment staat alleen wat je online hebt geopend op dit apparaat.",
                )}</small>
            </div>
          </div>

          {usage.quotaBytes ? (
            <p className="offline-manager-quota">{text(
              `This device gives the app ${humanSize(usage.quotaBytes)} of storage; ${humanSize(usage.usedBytes)} is in use.`,
              `Dit apparaat geeft de app ${humanSize(usage.quotaBytes)} opslag; ${humanSize(usage.usedBytes)} is in gebruik.`,
            )}</p>
          ) : null}

          <label className="check-field">
            <input type="checkbox" checked={includeFiles} disabled={busy} onChange={(event) => setIncludeFiles(event.target.checked)} />
            {text("Also download photos, 360° images and drawings (large)", "Ook foto’s, 360°-beelden en tekeningen ophalen (groot)")}
          </label>

          {busy ? (
            <div className="offline-manager-progress" role="status">
              <div className="offline-progress-track"><span style={{ width: `${percent}%` }} /></div>
              <p><Loader2 className="spin" size={14} /> {stepLabel}{progress?.bytes ? ` · ${humanSize(progress.bytes)}` : ""}</p>
            </div>
          ) : null}

          {!isOnline ? (
            <div className="operation-alert warning">
              <WifiOff size={18} />
              <div>
                <strong>{text("No connection right now", "Nu geen verbinding")}</strong>
                <span>{text("Downloading needs internet. What is already on the device stays usable.", "Ophalen vraagt internet. Wat al op het apparaat staat blijft bruikbaar.")}</span>
              </div>
            </div>
          ) : null}
          {error ? <div className="operation-alert error" role="alert"><AlertTriangle size={17} /> {error}</div> : null}
          {notice ? <div className="operation-alert success" role="status"><CheckCircle2 size={17} /> {notice}</div> : null}

          {/* Said plainly, because guessing wrong about this on site costs a day of work. */}
          <div className="offline-manager-explainer">
            <h3>{text("What works without internet", "Wat werkt zonder internet")}</h3>
            <ul>
              <li>{text("Opening the app from the home screen, including after restarting the phone.", "De app openen vanaf het beginscherm, ook na het herstarten van de telefoon.")}</li>
              <li>{text("Reading every downloaded project: registers, issues, NCRs, inspections, documents, deadlines and the action centre.", "Elk opgehaald project lezen: registers, issues, NCR’s, inspecties, documenten, deadlines en het actiecentrum.")}</li>
              <li>{text("Photos, 360° images and drawings that were downloaded, including marking them.", "Opgehaalde foto’s, 360°-beelden en tekeningen bekijken en markeren.")}</li>
              <li>{text("Taking photos and marking them: they queue on the device and upload by themselves once there is a connection.", "Foto’s maken en markeren: ze wachten op het apparaat en gaan vanzelf omhoog zodra er verbinding is.")}</li>
            </ul>
            <h3>{text("What still needs a connection", "Waar nog verbinding voor nodig is")}</h3>
            <ul>
              <li>{text("Saving a new issue, NCR, inspection, register item or day report. The form keeps what you typed until you are back online.", "Een nieuw issue, NCR, inspectie, registeritem of dagrapport opslaan. Het formulier houdt vast wat je hebt ingevuld tot je weer online bent.")}</li>
              <li>{text("Sending a link to a contractor, push notifications and the weather.", "Een link naar een aannemer sturen, pushmeldingen en het weer.")}</li>
            </ul>
          </div>
        </div>

        <footer className="modal-actions offline-manager-actions">
          {confirmingClear ? (
            <>
              <span className="offline-clear-warning">{text("Remove the downloaded copy from this device? Queued photos are kept.", "De opgehaalde kopie van dit apparaat verwijderen? Wachtende foto’s blijven staan.")}</span>
              <button className="secondary-button" type="button" onClick={() => setConfirmingClear(false)}>{text("Cancel", "Annuleren")}</button>
              <button className="danger-button" type="button" onClick={() => void clearOfflineCopy().then(() => { setConfirmingClear(false); setNotice(text("The offline copy has been removed.", "De offline kopie is verwijderd.")); return refresh(); })}><Trash2 size={15} /> {text("Remove", "Verwijderen")}</button>
            </>
          ) : (
            <>
              <button className="secondary-button" type="button" disabled={busy || !usage.files} onClick={() => setConfirmingClear(true)}><Trash2 size={15} /> {text("Remove offline copy", "Offline kopie verwijderen")}</button>
              {busy
                ? <button className="secondary-button" type="button" onClick={() => abortRef.current?.abort()}>{text("Stop", "Stoppen")}</button>
                : <button className="primary-button" type="button" disabled={!isOnline} onClick={() => void start()}><CloudDownload size={15} /> {summary ? text("Update offline copy", "Offline kopie bijwerken") : text("Make everything available offline", "Alles offline beschikbaar maken")}</button>}
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
