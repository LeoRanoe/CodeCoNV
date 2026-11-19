"use client";

import { Edit3, Eye, Undo2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";

const subscribeToNothing = () => () => {};
import { recordAnchorId, useRecordFocus } from "@/lib/navigation/record-focus";
import { isPendingRecordId } from "@/lib/offline/record-queue";
import { pendingStatus } from "@/lib/offline/pending-records";
import { useLanguage } from "@/lib/i18n";

export type RecordListRow = {
  id: string;
  icon: LucideIcon;
  title: string;
  meta: string;
  status: string;
  tone: string;
  onOpen?: () => void;
  onEdit?: () => void;
  /** Names what editing does when "Edit" is too vague, e.g. continuing a checklist. */
  editLabel?: string;
  onWithdraw?: () => void;
  /** Kept for older call sites while all record tabs move to the common actions. */
  open?: { label: string; onOpen: () => void };
};

export function RecordList({
  empty,
  rows,
  focusRecordId = "",
}: {
  empty: string;
  rows: RecordListRow[];
  focusRecordId?: string;
}) {
  const { text } = useLanguage();
  useRecordFocus(focusRecordId, rows.some((row) => row.id === focusRecordId));

  if (!rows.length) {
    return <div className="empty-list-state record-list-empty"><strong>{text("No records", "Geen registraties")}</strong><span>{empty}</span></div>;
  }

  return <div className="record-stack">{rows.map((row) => {
    const Icon = row.icon;
    const waiting = isPendingRecordId(row.id);
    const open = row.onOpen ?? row.open?.onOpen;
    return (
      <article
        className={`record-row ui-list-row ${waiting ? "record-waiting" : ""} ${focusRecordId === row.id ? "record-focused" : ""} ${open ? "record-row-clickable" : ""}`}
        id={recordAnchorId(row.id)}
        key={row.id}
        onClick={waiting ? undefined : open}
      >
        <span className="action-icon"><Icon size={18} /></span>
        <div><strong>{row.title}</strong><span>{row.meta}</span></div>
        {!waiting && (open || row.onEdit || row.onWithdraw) ? (
          <div className="record-row-actions">
            {open ? <button className="ui-button ui-button--secondary ui-button--sm record-row-open" type="button" onClick={(event) => { event.stopPropagation(); open(); }}><Eye size={14} /> {row.open?.label ?? text("View", "Bekijken")}</button> : null}
            {row.onEdit ? <button className="ui-button ui-button--secondary ui-button--sm record-row-edit" type="button" onClick={(event) => { event.stopPropagation(); row.onEdit?.(); }}><Edit3 size={14} /> {row.editLabel ?? text("Edit", "Bewerken")}</button> : null}
            {row.onWithdraw ? <button className="ui-button ui-button--quiet ui-button--sm record-row-withdraw" type="button" onClick={(event) => { event.stopPropagation(); row.onWithdraw?.(); }}><Undo2 size={14} /> {text("Withdraw", "Intrekken")}</button> : null}
          </div>
        ) : null}
        <span className={`task-status ui-status-badge ${waiting ? "waiting" : row.tone} ${row.tone === "red" ? "ui-status-badge--red" : row.tone === "green" ? "ui-status-badge--green" : ""}`}>{row.status === pendingStatus ? text("waiting to be sent", "wacht op verzending") : row.status}</span>
      </article>
    );
  })}</div>;
}

/**
 * The records already saved in a module. While the entry form is open they fold shut under
 * one bar: the client crossed the long lists out under every form, where they pushed the
 * save button off the screen. Closed form, open list — every module behaves the same way.
 */
export function SavedRecordsFold({ formOpen, count, children, storageKey = "" }: { formOpen: boolean; count: number; children: ReactNode; storageKey?: string }) {
  const { text } = useLanguage();
  // Whoever opens the bar keeps it open in that module on this device: a supervisor who
  // verifies records does not have to unfold them every time.
  const key = storageKey ? `codeco-saved-records-open:${storageKey}` : "";
  const stored = useSyncExternalStore(
    subscribeToNothing,
    () => { if (!key) return false; try { return window.localStorage.getItem(key) === "1"; } catch { return false; } },
    () => false,
  );
  const [chosen, setOpen] = useState<boolean | null>(null);
  const open = chosen ?? stored;
  if (!formOpen) return <>{children}</>;
  return (
    <details
      className="saved-records-fold"
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        setOpen(next);
        if (key) { try { window.localStorage.setItem(key, next ? "1" : "0"); } catch { /* storage unavailable */ } }
      }}
    >
      <summary>
        <span>{text("Saved records", "Opgeslagen registraties")}</span>
        <b>{count}</b>
      </summary>
      <div className="saved-records-fold-body">{children}</div>
    </details>
  );
}
