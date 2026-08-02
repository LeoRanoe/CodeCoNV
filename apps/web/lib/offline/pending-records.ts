"use client";

import type { OfflineRecord } from "@/lib/offline/record-queue";
import type { ProjectAction } from "@/lib/supabase/data";
import type { Finding, HseEvent, OperationSnapshot, RegisterEntry } from "@/lib/supabase/operations";

/**
 * A registration that is on the device but not yet in the database still has to be visible
 * where the person who wrote it will look for it. A record that disappears from the list
 * after saving reads as data loss, which is worse than the problem it was meant to solve.
 *
 * These rows are built from the queued input, carry the local id and a status of
 * `queued_offline`, and are read-only until they are sent: the number, the deadline rules
 * and the assignment are decided centrally.
 */
export const pendingStatus = "queued_offline";

function pendingFinding(record: OfflineRecord): Finding {
  const input = record.input as Record<string, unknown>;
  return {
    id: record.id,
    building_id: record.preview.buildingId ?? "",
    location_node_id: record.preview.locationNodeId,
    finding_number: "",
    finding_type: (record.preview.recordType || "deficiency") as Finding["finding_type"],
    title: record.preview.title,
    description: record.preview.description,
    severity: (record.preview.severity || "medium") as Finding["severity"],
    priority: (record.preview.priority || "normal") as Finding["priority"],
    status: pendingStatus as Finding["status"],
    responsible_party_id: (input.responsiblePartyId as string) || null,
    assigned_user_id: null,
    due_at: record.preview.dueAt,
    cause: null,
    proposed_correction: null,
    final_measure: null,
    issue_management: {
      issue_type: input.issueType as string | undefined,
      impact_summary: input.impactSummary as string | undefined,
      action_steps: input.actionSteps as string | undefined,
      escalation_required: Boolean(input.escalationRequired),
      disposition: input.disposition as Finding["issue_management"]["disposition"],
    },
    verified_by: null,
    verified_at: null,
    created_at: record.createdAt,
  };
}

function pendingHseEvent(record: OfflineRecord): HseEvent {
  return {
    id: record.id,
    building_id: record.preview.buildingId ?? "",
    location_node_id: record.preview.locationNodeId,
    event_number: "",
    event_type: record.preview.recordType || "unsafe_condition",
    title: record.preview.title,
    description: record.preview.description,
    severity: (record.preview.severity || "medium") as HseEvent["severity"],
    status: pendingStatus,
    confidential: Boolean((record.input as Record<string, unknown>).confidential),
    immediate_measure: ((record.input as Record<string, unknown>).immediateMeasure as string) || null,
    occurred_at: record.createdAt,
  };
}

function pendingRegisterEntry(record: OfflineRecord): RegisterEntry {
  const input = record.input as Record<string, unknown>;
  return {
    id: record.id,
    building_id: record.preview.buildingId,
    location_node_id: record.preview.locationNodeId,
    register_type: record.preview.recordType || "note",
    entry_number: "",
    title: record.preview.title,
    status: pendingStatus,
    occurred_at: record.createdAt,
    due_at: record.preview.dueAt,
    details: (input.details as Record<string, unknown>) ?? {},
  };
}

export function pendingProjectAction(record: OfflineRecord): ProjectAction {
  const input = record.input as Record<string, unknown>;
  return {
    id: record.id,
    action_number: "",
    title: record.preview.title,
    description: record.preview.description,
    due_at: record.preview.dueAt,
    priority: (record.preview.priority || "normal") as ProjectAction["priority"],
    status: pendingStatus as ProjectAction["status"],
    building_id: record.preview.buildingId,
    location_node_id: record.preview.locationNodeId,
    owner_user_id: (input.ownerUserId as string) || null,
    owner_party_id: (input.ownerPartyId as string) || null,
    closure_reason: null,
    created_at: record.createdAt,
    updated_at: record.createdAt,
  };
}

/**
 * The project snapshot with the registrations that are still on the device added to it, at
 * the top of their list because they are the newest thing that happened on site.
 */
export function withPendingRecords(snapshot: OperationSnapshot, records: OfflineRecord[]): OperationSnapshot {
  if (!records.length) return snapshot;
  const findings = records.filter((record) => record.kind === "finding").map(pendingFinding);
  const hseEvents = records.filter((record) => record.kind === "hse").map(pendingHseEvent);
  const registerEntries = records.filter((record) => record.kind === "register").map(pendingRegisterEntry);
  if (!findings.length && !hseEvents.length && !registerEntries.length) return snapshot;
  return {
    ...snapshot,
    findings: [...findings, ...snapshot.findings],
    hseEvents: [...hseEvents, ...snapshot.hseEvents],
    registerEntries: [...registerEntries, ...snapshot.registerEntries],
  };
}

export function withPendingActions(actions: ProjectAction[], records: OfflineRecord[]) {
  const pending = records.filter((record) => record.kind === "action").map(pendingProjectAction);
  return pending.length ? [...pending, ...actions] : actions;
}
