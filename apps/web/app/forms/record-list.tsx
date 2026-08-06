"use client";

import { CheckCircle2, Edit3, Eye, Undo2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
    return <div className="empty-list-state"><CheckCircle2 size={22} /><strong>{text("No records", "Geen registraties")}</strong><span>{empty}</span></div>;
  }

  return <div className="record-stack">{rows.map((row) => {
    const Icon = row.icon;
    const waiting = isPendingRecordId(row.id);
    const open = row.onOpen ?? row.open?.onOpen;
    return (
      <article
        className={`record-row ${waiting ? "record-waiting" : ""} ${focusRecordId === row.id ? "record-focused" : ""} ${open ? "record-row-clickable" : ""}`}
        id={recordAnchorId(row.id)}
        key={row.id}
        onClick={waiting ? undefined : open}
      >
        <span className="action-icon"><Icon size={18} /></span>
        <div><strong>{row.title}</strong><span>{row.meta}</span></div>
        {!waiting && (open || row.onEdit || row.onWithdraw) ? (
          <div className="record-row-actions">
            {open ? <button className="secondary-button record-row-open" type="button" onClick={(event) => { event.stopPropagation(); open(); }}><Eye size={14} /> {row.open?.label ?? text("View", "Bekijken")}</button> : null}
            {row.onEdit ? <button className="secondary-button record-row-edit" type="button" onClick={(event) => { event.stopPropagation(); row.onEdit?.(); }}><Edit3 size={14} /> {text("Edit", "Bewerken")}</button> : null}
            {row.onWithdraw ? <button className="ghost-button record-row-withdraw" type="button" onClick={(event) => { event.stopPropagation(); row.onWithdraw?.(); }}><Undo2 size={14} /> {text("Withdraw", "Intrekken")}</button> : null}
          </div>
        ) : null}
        <span className={`task-status ${waiting ? "waiting" : row.tone}`}>{row.status === pendingStatus ? text("waiting to be sent", "wacht op verzending") : row.status}</span>
      </article>
    );
  })}</div>;
}
