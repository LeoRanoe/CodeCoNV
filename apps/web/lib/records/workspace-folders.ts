import type { FormIconKey } from "@/app/forms/form-icons";

/**
 * The folders of Records & Photos: one for each item of the Workspace, with the same name and in the same
 * order. A folder holds the submitted records of that item; Photos opens the photo library. `kind` is the form
 * type the archive filters on (a register subtype, "hse:incident", or a whole kind such as "finding").
 * tests/workspace-folders.test.mjs keeps the names equal to the tiles of project-workspace-home.tsx.
 */
export type WorkspaceFolder = { id: string; icon: FormIconKey; en: string; nl: string; kind: string | null };

export const workspaceFolders: WorkspaceFolder[] = [
  { id: "photos", icon: "photos", en: "Photos", nl: "Foto's", kind: null },
  { id: "works-ongoing", icon: "works_ongoing", en: "Works ongoing", nl: "Werkzaamheden gaande", kind: "register:works_ongoing" },
  { id: "works-completed", icon: "works_completed", en: "Works completed", nl: "Werkzaamheden afgerond", kind: "register:works_completed" },
  { id: "workforce", icon: "workforce", en: "Workforce", nl: "Workforce", kind: "workforce" },
  { id: "delay-report", icon: "delay_report", en: "Project Delay Report (PDR)", nl: "Vertragingsrapport (PDR)", kind: "register:delay_report" },
  { id: "issues", icon: "issue", en: "Issues", nl: "Issues", kind: "finding" },
  { id: "hse", icon: "hse", en: "HSE", nl: "HSE", kind: "hse" },
  { id: "materials-delivery", icon: "delivery", en: "Materials delivery", nl: "Materiaallevering", kind: "register:delivery" },
  { id: "inspections", icon: "inspection", en: "Inspections", nl: "Inspecties", kind: "inspection" },
  { id: "technical-instructions", icon: "technical_instruction", en: "Technical instructions", nl: "Technische instructies", kind: "register:technical_instruction" },
  { id: "change-order", icon: "change_order", en: "Change order (CO)", nl: "Change order (CO)", kind: "register:change_order" },
  { id: "ncr", icon: "ncr", en: "NCR", nl: "NCR", kind: "ncr" },
  { id: "lessons-learned", icon: "lessons_learned", en: "Lessons Learned (LL)", nl: "Geleerde lessen (LL)", kind: "register:lessons_learned" },
  { id: "hse-incident", icon: "hse_incident", en: "HSE incident", nl: "HSE-incident", kind: "hse:incident" },
  { id: "agreements-made", icon: "agreement", en: "Agreements Made", nl: "Gemaakte afspraken", kind: "register:agreement" },
];
