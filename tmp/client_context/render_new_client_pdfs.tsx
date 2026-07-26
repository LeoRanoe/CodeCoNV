import React from "react";
import { renderToFile } from "@react-pdf/renderer";
import { readFileSync } from "node:fs";
import { ControlledDocument } from "../../apps/web/lib/reports/controlled-document-pdf";
import { DailyReportDocument, type DailyReportPdfSnapshot } from "../../apps/web/lib/reports/daily-report-pdf";
import { NcrDocument } from "../../apps/web/lib/reports/ncr-pdf";
import { PeriodReportDocument } from "../../apps/web/lib/reports/period-report-pdf";
import type { Finding, FindingProgressUpdate, PeriodReportSnapshot, RegisterEntry } from "../../apps/web/lib/supabase/operations";

const outputRoot = "D:/CodeCoNV/tmp/client_context/generated_pdf_qa";
const logoSource = `data:image/png;base64,${readFileSync("D:/CodeCoNV/apps/web/public/codeco-logo-pdf.png").toString("base64")}`;

const entry: RegisterEntry = {
  id: "00000000-0000-0000-0000-000000000001",
  register_type: "rfa",
  entry_number: "RFA-SU-L1054-001",
  title: "Lighting switch layout of Building B1",
  status: "approved",
  occurred_at: "2026-07-24T12:00:00-03:00",
  due_at: "2026-07-31T23:59:59-03:00",
  details: {
    schema: "codeco.controlled-document.v1",
    document_type: "rfa",
    project_name: "Health Service Improvement Project",
    project_number: "SU-L1054",
    building_name: "Building B1",
    subject: "Lighting switch layout of Building B1",
    description: "Request approval of the lighting switch layout of Building B1.",
    issue_date: "2026-07-24",
    due_date: "2026-07-31",
    revision: "4",
    issued_by: "Test Supervisor",
    issuer_position: "Construction Supervisor",
    requested_to: "MOH-BOG Management Team",
    related_reference: "RFA.SU-L1054.519.4",
    reference_documents: "Approved electrical drawings",
    attachments: "Lighting switch layout of Building B1.zip · 1 page",
    response: {
      decision: "approved_with_comments",
      comments: "Approved subject to the coordination comments.",
      respondent_name: "Project Manager",
      respondent_position: "Client Project Manager",
      respondent_company: "Ministry of Health",
      response_date: "2026-07-25",
    },
  },
};

const finding: Finding = {
  id: "00000000-0000-0000-0000-000000000002",
  finding_number: "Q-2026-0001",
  finding_type: "ncr",
  title: "Curtain wall connection",
  description: "Cracking is visible at the gypsum wall connection and curtain wall profile.",
  severity: "high",
  priority: "high",
  status: "ready_for_verification",
  responsible_party_id: "00000000-0000-0000-0000-000000000003",
  assigned_user_id: null,
  due_at: "2026-07-27T23:59:59-03:00",
  cause: null,
  proposed_correction: null,
  final_measure: "Connection caulked and refinished in accordance with the approved detail.",
  issue_management: {
    issue_type: "quality",
    impact_summary: "May delay room handover.",
    action_steps: "Caulk and finish the gypsum wall connection with the curtain wall profiles.",
    escalation_required: false,
    disposition: "to_be_corrected",
    source_catalog_subject: "Curtain wall",
  },
  verified_at: null,
  created_at: "2026-07-24T12:00:00-03:00",
};

const progress: FindingProgressUpdate = {
  id: "00000000-0000-0000-0000-000000000004",
  finding_id: finding.id,
  progress_percent: 100,
  disposition: "validated",
  note: "Repair complete and ready for independent verification.",
  inspected_at: "2026-07-25T12:00:00-03:00",
  created_at: "2026-07-25T12:00:00-03:00",
};

const snapshot: PeriodReportSnapshot = {
  schema_version: "202607240001",
  generated_at: "2026-07-24T18:00:00-03:00",
  period: { start_date: "2026-07-18", end_date: "2026-07-24" },
  project: { id: "p1", code: "SU-L1054", name: "Health Service Improvement Project", location: "Paramaribo", client_name: "Ministry of Health" },
  buildings: [{ id: "b1", code: "B1", name: "Building B1", status: "active" }],
  parties: [{ id: "party1", code: "MOH", name: "Ministry of Health", party_type: "client" }, { id: "party2", code: "MAIN", name: "Main Contractor", party_type: "contractor" }],
  day_reports: [{ id: "dr1", building_id: "b1", report_date: "2026-07-24", report_number: "DR-2026-0123", status: "approved" }],
  day_starts: [{ day_report_id: "dr1", weather_condition: "sunny", temperature_c: 32, wind_condition: "moderate", shift_start: "07:00", shift_end: "16:00", planned_work: "Install lighting switches and complete wall finishes." }],
  day_closeouts: [{ day_report_id: "dr1", day_summary: "Planned installation and inspection work completed.", work_performed: "Lighting switches installed; curtain-wall repair inspected.", progress_percent: 86, tomorrow_plan: "Complete remaining finishes and cleaning.", inspection_result: "issues", quality_details: "Curtain-wall repair requires final verification.", hse_event: "none", hse_details: "", communication: "Contractor instructed to submit completion evidence." }],
  attendance: [{ discipline: "Electrical", headcount: 6 }, { discipline: "Finishing", headcount: 9 }],
  registrations: [{ id: "reg1", title: "Lighting switch installation", status: "completed", occurred_at: "2026-07-24T10:00:00-03:00", details: { location: "B1 second floor" } }],
  inspections: [{ id: "ins1", building_id: "b1", inspection_number: "INS-2026-0001", title: "Lighting switch alignment", status: "passed", created_at: "2026-07-24T11:00:00-03:00" }],
  findings: [{ ...finding, building_id: "b1" }],
  finding_progress_updates: [progress],
  hse_events: [],
  register_entries: [{ ...entry, building_id: "b1" }, { id: "er1", building_id: "b1", register_type: "environmental_report", entry_number: "ER-001", title: "Housekeeping inspection", status: "open", occurred_at: "2026-07-24T12:30:00-03:00", details: { description: "Construction debris must be removed and materials stacked neatly." } }],
  visual_captures: [{ id: "photo1", building_id: "b1", title: "B1 current progress", status: "active", captured_at: "2026-07-24T15:00:00-03:00" }],
  open_actions: [{ id: "a1", action_number: "ACT-001", title: "Submit completion evidence", status: "open", due_at: "2026-07-26T12:00:00-03:00" }],
  files: [{ id: "file1", building_id: "b1", original_name: "lighting-switch-layout.pdf", category: "drawing", created_at: "2026-07-24T09:00:00-03:00" }],
  media_folders: [{ id: "folder1", building_id: "b1", name: "Current progress", folder_type: "images" }],
};

const dailySnapshot: DailyReportPdfSnapshot = {
  reportNumber: "DR-2026-0123",
  reportDate: "2026-07-24",
  projectName: "Health Service Improvement Project",
  projectCode: "SU-L1054",
  buildingName: "Building B1",
  location: "Paramaribo",
  supervisorName: "Test Supervisor",
  attendanceTotal: 15,
  registrationCount: 1,
  projectStart: {
    weatherCondition: "sunny",
    temperatureC: 32,
    windCondition: "moderate",
    shiftStart: "07:00",
    shiftEnd: "16:00",
    plannedWork: "Install lighting switches and complete wall finishes.",
    expectedWorkers: 15,
    inspectionPlanned: "yes",
    highRiskWork: "no",
    concreteWork: "no",
    workPermit: "available",
    drawingStatus: "approved",
    drawingIssueReported: false,
    riskNotes: "",
  },
  closeout: {
    daySummary: "Planned installation and inspection work was completed during the shift.",
    weatherSummary: "Sunny and dry throughout the working day.",
    workPerformed: "Lighting switches were installed and the curtain-wall repair was inspected.",
    progressPercent: 86,
    inspectionResult: "issues",
    qualityIssues: "yes",
    qualityDetails: "Curtain-wall repair requires final independent verification.",
    hseEvent: "none",
    hseDetails: "",
    equipmentStatus: "All equipment operational.",
    deliveries: "No deliveries.",
    testsMeasurements: "Switch alignment visually checked.",
    variationWork: "none",
    delayCause: "none",
    delayHours: 0,
    communication: "Contractor instructed to submit completion evidence.",
    risks: "Remaining finishes must be protected.",
    tomorrowPlan: "Complete remaining finishes and carry out final cleaning.",
    photoCount: 3,
    attachmentsConfirmed: true,
  },
};

async function main() {
  await Promise.all([
    renderToFile(<ControlledDocument entry={entry} logoSource={logoSource} />, `${outputRoot}/controlled-rfa.pdf`),
    renderToFile(<DailyReportDocument snapshot={dailySnapshot} logoSource={logoSource} />, `${outputRoot}/daily-report.pdf`),
    renderToFile(<NcrDocument finding={finding} progress={progress} context={{ projectName: "Health Service Improvement Project", projectCode: "SU-L1054", buildingName: "Building B1", issuerName: "Test Supervisor", responsiblePartyName: "Main Contractor" }} logoSource={logoSource} />, `${outputRoot}/ncr.pdf`),
    renderToFile(<PeriodReportDocument snapshot={snapshot} options={{ reportTitle: "Weekly supervision report · Complete project report" }} logoSource={logoSource} />, `${outputRoot}/weekly-report.pdf`),
  ]);
}

void main();
