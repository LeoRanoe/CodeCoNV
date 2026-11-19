"""Generate lib/forms/spec-catalogue.ts from the client's developer specification workbook.

Usage: python scripts/generate-spec-catalogue.py <path to Construction_Project_App_Developer_Specification_FINAL_v2.xlsx>

Every dropdown value in the app's forms comes from this file, so the lists stay exactly as the
client wrote them. Re-run after the client sends a new workbook and review the diff.
"""
import json
import re
import sys

import openpyxl

wb = openpyxl.load_workbook(sys.argv[1], data_only=True)


def rows(sheet):
    out = {}
    for r in wb[sheet].iter_rows(values_only=True):
        if r and r[0] is not None and str(r[0]).strip().isdigit():
            out.setdefault(int(str(r[0]).strip()), []).append(r)
    return out


def cell(sheet, order, col=4, nth=0):
    return str(rows(sheet)[order][nth][col] or "")


def clean(text):
    return re.sub(r"\s+", " ", text.replace("–", "-")).strip()


def flat(text):
    items = []
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("•"):
            items.append(clean(line[1:]))
    return items


def grouped(text):
    groups, current = {}, None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("•"):
            body = clean(line[1:])
            name, _, description = body.partition(" — ")
            groups[current].append({"value": name.strip(), "description": description.strip()})
        elif line.endswith(":"):
            current = clean(line[:-1])
            groups[current] = []
    return groups


def slash(text):
    return [clean(part) for part in text.split(" / ")]


catalogue = {}
catalogue["workDisciplines"] = flat(cell("Works Ongoing", 5))

guide = {}
for r in list(wb["Activity Detail Guide"].iter_rows(values_only=True))[1:]:
    if not r[0]:
        continue
    guide.setdefault(clean(r[0]), []).append({
        "value": clean(r[1]),
        "description": clean(r[2] or ""),
        "completionOptions": flat(r[3] or ""),
        "prompts": flat(r[4] or ""),
    })
catalogue["activities"] = guide

catalogue["shifts"] = flat(cell("Works Ongoing", 4))
catalogue["units"] = flat(cell("Works Ongoing", 11))
catalogue["progressStatuses"] = flat(cell("Works Ongoing", 12))
catalogue["workBlockers"] = slash(cell("Works Ongoing", 19))
catalogue["completionInspectionStatuses"] = flat(cell("Works Completed", 11))

catalogue["photoPurposes"] = flat(cell("Photos", 3))

catalogue["delayCauseTypes"] = flat(cell("Project Delay Report", 7))
catalogue["delayCauseCategories"] = grouped(cell("Project Delay Report", 8))
catalogue["responsibleParties"] = flat(cell("Project Delay Report", 10))
catalogue["durationUnits"] = flat(cell("Project Delay Report", 12))
catalogue["criticalPathImpacts"] = flat(cell("Project Delay Report", 13))
catalogue["recordStatuses"] = flat(cell("Project Delay Report", 19))

catalogue["issueTypes"] = flat(cell("Issue", 4))
catalogue["issueCategories"] = grouped(cell("Issue", 5))
catalogue["priorities"] = flat(cell("Issue", 10))
catalogue["impactTypes"] = flat(cell("Issue", 11))

catalogue["hseTypes"] = flat(cell("HSE", 4))
catalogue["hseCategories"] = grouped(cell("HSE", 5))
catalogue["potentialConsequences"] = flat(cell("HSE", 10))
catalogue["riskLikelihoods"] = flat(cell("HSE", 11))
catalogue["riskSeverities"] = flat(cell("HSE", 12))

catalogue["materialGroups"] = flat(cell("Materials Delivery", 7))
catalogue["materialCategories"] = grouped(cell("Materials Delivery", 8))
catalogue["deliveryStatuses"] = flat(cell("Materials Delivery", 13))
catalogue["arrivalConditions"] = flat(cell("Materials Delivery", 14))
catalogue["deliveryInspectionResults"] = flat(cell("Materials Delivery", 15))

catalogue["instructionTypes"] = flat(cell("Technical Instructions", 4))
ti_categories = {}
for group, items in grouped(cell("Technical Instructions", 6)).items():
    ti_categories[group] = items
# The TI category cell lists bare subjects (no " — description"); grouped() keeps them as values.
catalogue["instructionCategories"] = ti_categories
catalogue["instructionReasons"] = slash(cell("Technical Instructions", 10))

catalogue["changeTypes"] = flat(cell("Change Order", 4))
catalogue["changeCategories"] = grouped(cell("Change Order", 5))
catalogue["changeApprovalStatuses"] = flat(cell("Change Order", 16))
catalogue["instructionToProceed"] = flat(cell("Change Order", 18))

catalogue["ncrTypes"] = flat(cell("NCR", 4))
catalogue["ncrCategories"] = grouped(cell("NCR", 5))
catalogue["ncrDetectedDuring"] = flat(cell("NCR", 11))
catalogue["ncrSeverities"] = ["Minor", "Major", "Critical"]
# The containment row is numbered "1" in the workbook (a typo for 14); it is the second row with order 1.
catalogue["ncrContainment"] = [clean(line) for line in cell("NCR", 1, nth=1).splitlines() if line.strip()]
catalogue["ncrDispositions"] = flat(cell("NCR", 15))
catalogue["rootCauseCategories"] = flat(cell("NCR", 16))
catalogue["verificationResults"] = flat(cell("NCR", 21))

catalogue["lessonPhases"] = flat(cell("Lessons Learned", 4))
catalogue["lessonCategories"] = grouped(cell("Lessons Learned", 5))
catalogue["lessonApplicability"] = flat(cell("Lessons Learned", 13))
catalogue["lessonReviewStatuses"] = flat(cell("Lessons Learned", 17))

catalogue["agreementSources"] = flat(cell("Agreements Made", 4))
catalogue["agreementTypes"] = flat(cell("Agreements Made", 5))
catalogue["agreementCategories"] = grouped(cell("Agreements Made", 6))

catalogue["incidentTypes"] = flat(cell("HSE Incident Registration", 5))
catalogue["incidentCategories"] = grouped(cell("HSE Incident Registration", 6))
catalogue["injuryClassifications"] = flat(cell("HSE Incident Registration", 11))
catalogue["injuryNatures"] = flat(cell("HSE Incident Registration", 12))
catalogue["bodyParts"] = flat(cell("HSE Incident Registration", 13))
catalogue["environmentalImpacts"] = flat(cell("HSE Incident Registration", 14))
catalogue["propertyDamage"] = flat(cell("HSE Incident Registration", 15))
catalogue["notificationStates"] = ["Not Required", "Pending", "Notified"]
catalogue["investigationRequired"] = flat(cell("HSE Incident Registration", 20))

shared = {}
for r in wb["Shared Dropdown Lists"].iter_rows(values_only=True):
    if r and r[0] and r[1] and str(r[1]).strip().startswith("•"):
        shared[clean(r[0])] = flat(str(r[1]))
catalogue["attendanceStatuses"] = shared["Attendance status"]
catalogue["competencyStatuses"] = shared["Competency / authorization status"]
catalogue["sharedUnits"] = shared["Unit"]

for key, value in catalogue.items():
    assert value, f"empty list: {key}"

lines = [
    "// Generated by scripts/generate-spec-catalogue.py from the client's developer specification",
    "// workbook (FINAL v2). Do not edit by hand: change the workbook and run the script again.",
    "/* eslint-disable */",
    "",
    "export type SpecOption = { value: string; description: string };",
    "export type SpecActivity = SpecOption & { completionOptions: string[]; prompts: string[] };",
    "",
]
for key, value in catalogue.items():
    if key == "activities":
        kind = "Record<string, SpecActivity[]>"
    elif isinstance(value, dict):
        kind = "Record<string, SpecOption[]>"
    else:
        kind = "string[]"
    lines.append(f"export const {key}: {kind} = {json.dumps(value, ensure_ascii=False, indent=2)};")
    lines.append("")

with open("lib/forms/spec-catalogue.ts", "w", encoding="utf-8", newline="\n") as handle:
    handle.write("\n".join(lines))
print({key: len(value) for key, value in catalogue.items()})
