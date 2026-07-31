export const controlledDocumentTypes = [
  "wcr",
  "rfi",
  "rfa",
  "inspection_request",
  "technical_instruction",
  "change_order",
  "environmental_report",
] as const;

export type ControlledDocumentType = (typeof controlledDocumentTypes)[number];

export type ControlledDocumentDraft = {
  type: string;
  title: string;
  details: string;
  responsiblePartyId: string;
  dueDate: string;
  revision: string;
  requestedTo: string;
  /** Who draws the document up. Empty means the signed-in user. */
  issuerName: string;
  /** Set when the author signs the document; kept with the moment of signing. */
  signedBy: string;
  signedAt: string;
  issuerPosition: string;
  issuerCompany: string;
  discipline: string;
  priority: string;
  relatedReference: string;
  referenceDocuments: string;
  attachments: string;
  reason: string;
  requiredAction: string;
  scheduleImpact: string;
  costImpact: string;
  impactExplanation: string;
  readyDate: string;
  readyTime: string;
  inspectionCategory: string;
  periodStart: string;
  periodEnd: string;
  lostHours: string;
  lostHoursReason: string;
};

export type ControlledDocumentContext = {
  projectName: string;
  projectCode: string;
  buildingName: string;
  currentUserName: string;
};

export type IssueCatalogPreset = {
  subject: string;
  description: string;
  action: string;
  disposition: "to_be_corrected" | "alternative_solution";
};

export const emptyControlledDocumentDraft: ControlledDocumentDraft = {
  type: "delivery",
  title: "",
  details: "",
  responsiblePartyId: "",
  dueDate: "",
  revision: "0",
  requestedTo: "",
  issuerName: "",
  signedBy: "",
  signedAt: "",
  issuerPosition: "Construction Supervisor",
  issuerCompany: "CODECO N.V.",
  discipline: "architectural",
  priority: "medium",
  relatedReference: "",
  referenceDocuments: "",
  attachments: "",
  reason: "",
  requiredAction: "proceed",
  scheduleImpact: "none",
  costImpact: "none",
  impactExplanation: "",
  readyDate: "",
  readyTime: "07:30",
  inspectionCategory: "architectural",
  periodStart: "",
  periodEnd: "",
  lostHours: "0",
  lostHoursReason: "",
};

export function isControlledDocumentType(value: string): value is ControlledDocumentType {
  return controlledDocumentTypes.includes(value as ControlledDocumentType);
}

export function createControlledDocumentDetails(
  draft: ControlledDocumentDraft,
  context: ControlledDocumentContext,
) {
  const issueDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Paramaribo",
  }).format(new Date());

  return {
    schema: "codeco.controlled-document.v1",
    document_type: draft.type,
    project_name: context.projectName,
    project_number: context.projectCode,
    building_name: context.buildingName,
    subject: draft.title.trim(),
    description: draft.details.trim(),
    issue_date: issueDate,
    due_date: draft.dueDate || null,
    revision: draft.revision.trim() || "0",
    issued_by: draft.issuerName.trim() || context.currentUserName,
    issuer_position: draft.issuerPosition.trim(),
    issuer_company: draft.issuerCompany.trim(),
    requested_to: draft.requestedTo.trim(),
    discipline: draft.discipline,
    priority: draft.priority,
    related_reference: draft.relatedReference.trim(),
    reference_documents: draft.referenceDocuments.trim(),
    attachments: draft.attachments.trim(),
    // The client's form does not ask for these two, but a technical instruction is
    // invalid in the database without them: derive instead of prompt.
    reason: draft.reason.trim() || draft.details.trim(),
    required_action: draft.requiredAction || "proceed",
    signed_by: draft.signedBy.trim(),
    signed_by_position: draft.signedBy.trim() ? draft.issuerPosition.trim() : "",
    signed_at: draft.signedAt || null,
    schedule_impact: draft.scheduleImpact,
    cost_impact: draft.costImpact,
    impact_explanation: draft.impactExplanation.trim(),
    ready_date: draft.readyDate || null,
    ready_time: draft.readyTime || null,
    inspection_category: draft.inspectionCategory,
    period_start: draft.periodStart || null,
    period_end: draft.periodEnd || null,
    lost_hours: Number(draft.lostHours || 0),
    lost_hours_reason: draft.lostHoursReason.trim(),
    response: {},
  };
}

export const issueCatalogPresets: IssueCatalogPreset[] = [
  { subject: "Sweep tile", description: "The gap at the bottom sweep tile is visible. Finish the top straight and clean the sweep tile.", action: "Finish the top and bottom of the sweep tile and clean it.", disposition: "to_be_corrected" },
  { subject: "LVT", description: "Damaged LVT, excessive super glue or popping joints are visible.", action: "Install or repair the LVT neatly without visible defects.", disposition: "to_be_corrected" },
  { subject: "Paint", description: "Wall paint, visible corner profiles or corner alignment require rectification.", action: "Rectify all visible paint issues.", disposition: "to_be_corrected" },
  { subject: "Wall tile", description: "Tile grout joints, tiles or corner profiles are not uniform or clean.", action: "Make all tile joints uniform and clean the tiles and profiles.", disposition: "to_be_corrected" },
  { subject: "Sockets / outlets", description: "Sockets or outlets are unfinished or require replacement.", action: "Install and finish sockets and outlets neatly.", disposition: "to_be_corrected" },
  { subject: "Curtain wall", description: "Cracks are visible at the gypsum wall connection or curtain wall profile.", action: "Caulk and finish the gypsum wall connection with the curtain wall profiles.", disposition: "to_be_corrected" },
  { subject: "Partition glass", description: "Partition glass joints are not neatly finished.", action: "Rectify joints at corners and between glass panels.", disposition: "to_be_corrected" },
  { subject: "Cleaning", description: "The inspected element or work area is dirty.", action: "Clean the element and leave the work area ready for inspection.", disposition: "to_be_corrected" },
  { subject: "Floor joint profile", description: "The floor joint profile does not have proper adhesion.", action: "Submit and implement a durable solution that securely fixes the profile.", disposition: "alternative_solution" },
  { subject: "Floor tile", description: "Floor tiles are damaged or grout joints are defective.", action: "Replace damaged tiles and grout the joints correctly.", disposition: "to_be_corrected" },
  { subject: "Custom furniture", description: "Cabinet doors, countertop finishes, visible holes or brackets are not acceptable.", action: "Improve usability and finishing and seal all visible holes.", disposition: "to_be_corrected" },
  { subject: "MDF door", description: "MDF door frames are damaged or doors and frames have paint stains.", action: "Repair the frames and remove all paint stains.", disposition: "to_be_corrected" },
  { subject: "Plumbing / leakage", description: "AC or ceiling leakage is visible.", action: "Find and repair the leakage and prevent further damage.", disposition: "to_be_corrected" },
  { subject: "Decoration", description: "Decoration has paint stains or incomplete finishing.", action: "Clean, protect cut edges and complete the installation.", disposition: "to_be_corrected" },
  { subject: "Ceiling", description: "Paint differences or other visible defects are present on the ceiling.", action: "Rectify the ceiling to obtain a uniform finish.", disposition: "to_be_corrected" },
  { subject: "Lights", description: "A crack, gap or unfinished frame is visible around a light fitting.", action: "Repair the crack or gap and finish the light frame neatly.", disposition: "to_be_corrected" },
  { subject: "Junction box", description: "A junction box is not neatly finished or has no cover plate.", action: "Install the correct cover plate and finish the junction box.", disposition: "to_be_corrected" },
  { subject: "Clean ceiling", description: "The ceiling requires final cleaning.", action: "Clean the ceiling to a spotless and smooth condition.", disposition: "to_be_corrected" },
  { subject: "Service stair door", description: "The door direction or panic hardware does not comply with the approved drawing.", action: "Correct the door direction and install the specified emergency hardware.", disposition: "to_be_corrected" },
  { subject: "Emergency stair", description: "Emergency stair paintwork is incomplete.", action: "Apply the specified protective resin topcoat and finish the railing anchors.", disposition: "to_be_corrected" },
  { subject: "Emergency lights", description: "Emergency lights are missing in a stairwell.", action: "Install and test the required emergency lights.", disposition: "to_be_corrected" },
  { subject: "Roof drains", description: "The water-resistant layer and drain build-up are in the wrong sequence.", action: "Correct the waterproofing sequence and reinstall the drain dome.", disposition: "to_be_corrected" },
  { subject: "Mineral wool board", description: "Mineral wool boards are damaged or inconsistent.", action: "Replace damaged boards and use one approved board type.", disposition: "to_be_corrected" },
  { subject: "Ceramic partition wall", description: "Ceramic urinal partition walls are missing.", action: "Install the specified ceramic partition walls.", disposition: "to_be_corrected" },
  { subject: "Steel structure", description: "The steel structure does not have the required fireproof coating.", action: "Apply the approved fireproof coating system.", disposition: "to_be_corrected" },
  { subject: "Washbasin", description: "Washbasin drains or fittings do not comply.", action: "Install compliant washbasin drainage and fittings.", disposition: "to_be_corrected" },
  { subject: "Roof overflow", description: "Required overflow pipes are missing or visibly positioned.", action: "Install the overflows behind the louvers and keep them out of street view.", disposition: "to_be_corrected" },
  { subject: "HVAC", description: "Roof ducting is damaged or its supports are unstable.", action: "Replace damaged ducting and secure all supports.", disposition: "to_be_corrected" },
  { subject: "Roof waterproof paint", description: "An additional layer of waterproof coating is required.", action: "Apply the remaining approved waterproof coating layer.", disposition: "to_be_corrected" },
  { subject: "Roof cutouts", description: "Roof cutouts associated with leakage are not correctly sealed.", action: "Repair and seal all affected roof cutouts.", disposition: "to_be_corrected" },
  { subject: "Roof air vent pipe", description: "Roof vents are too close together and can collide.", action: "Reposition or reinforce the vents with approved brackets.", disposition: "to_be_corrected" },
  { subject: "Rusting bolts and washers", description: "Bolts and washers at the louvers are starting to rust.", action: "Submit a durable corrosion-control solution for approval.", disposition: "alternative_solution" },
  { subject: "Damaged louver", description: "Louvers are damaged or rusted.", action: "Submit a replacement or repair solution for approval.", disposition: "alternative_solution" },
  { subject: "Main entrance door", description: "The main entrance door is broken.", action: "Install a compliant replacement glass door.", disposition: "to_be_corrected" },
  { subject: "Broken curtain wall glass", description: "Curtain wall glass is broken.", action: "Replace the broken curtain wall panel and verify the installation.", disposition: "to_be_corrected" },
];
