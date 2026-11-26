"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SpecConfiguration, SpecFormKey } from "@/lib/forms/spec-forms";

/**
 * The live registers behind the specification's pickers (START HERE: "Project, location, user,
 * contractor, supplier, crew and linked-record selections must come from live app registers"):
 * the project's people, its parties, its own records and its location tree, plus the project's
 * configured lists and who may take the reviewer's decisions.
 */
export type SpecPerson = { id: string; name: string; role?: string };
export type SpecParty = { id: string; name: string; type: string };
export type SpecRecordOption = { id: string; kind: string; registerType?: string; code: string; title: string; linkSpec?: Record<string, string> | null; linkedRefs?: string[] | null };
export type SpecLocation = { id: string; label: string };
/** The Project Documents register, for exact revision references (F11). */
export type SpecDocument = { id: string; document_number: string | null; title: string; current_revision_id: string | null };
export type SpecRevision = { id: string; document_id: string; revision: string; review_status: string; uploaded_at: string; superseded_at: string | null };

export type SpecDirectoryValue = {
  people: SpecPerson[];
  parties: SpecParty[];
  records: SpecRecordOption[];
  locations: SpecLocation[];
  documents: SpecDocument[];
  revisions: SpecRevision[];
  config: SpecConfiguration | null;
  /** Whether this user may choose the reviewer-only values of this form. */
  canDecide: (form: SpecFormKey) => boolean;
  /** HSE managers see the restricted incident fields. */
  canSeeSensitive: boolean;
  currentUser: { id: string; name: string } | null;
  /** The label shown for a stored (English) workbook value. */
  translate: (value: string) => string;
  /** Reloads the Project Documents register (a revision picker opening on a register that changed). */
  refreshDocuments?: () => void;
  /** Opens a linked record (`<kind>:<id>`). */
  openRecord?: (ref: string) => void;
};

const emptyDirectory: SpecDirectoryValue = {
  people: [],
  parties: [],
  records: [],
  locations: [],
  documents: [],
  revisions: [],
  config: null,
  // Outside a project the database still decides; the screen does not pretend otherwise.
  canDecide: () => true,
  canSeeSensitive: false,
  currentUser: null,
  translate: (value) => value,
};

const SpecDirectoryContext = createContext<SpecDirectoryValue>(emptyDirectory);

export function SpecDirectoryProvider({ value, children }: { value: Partial<SpecDirectoryValue>; children: ReactNode }) {
  return <SpecDirectoryContext.Provider value={{ ...emptyDirectory, ...value }}>{children}</SpecDirectoryContext.Provider>;
}

export const useSpecDirectory = () => useContext(SpecDirectoryContext);

/** Whether a record of the directory belongs to one of a field's record kinds. */
export function recordMatchesKinds(record: SpecRecordOption, kinds?: string[]) {
  if (!kinds?.length) return ["finding", "ncr", "hse", "inspection", "register"].includes(record.kind);
  return kinds.some((kind) => kind === record.kind || (kind.startsWith("register:") && record.kind === "register" && record.registerType === kind.slice(9)));
}
