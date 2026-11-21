# Workbook requirement trace

Each table uses the physical Excel row so the original field, required flag, control and conditions can be found precisely. “Mapped” means that a source control or system field could be identified. It does not certify all dependencies, persistence, permissions, or runtime behavior. Findings are indexed in the [audit](README.md).

Workbook source — Construction_Project_App_Developer_Specification_FINAL_v2.xlsx. The app schema and workbook use different field identifiers. Numbering below follows the sheet’s displayed order values.
Coverage inventory — **277 form rows** and **147 activity rows**. Regeneration matched the stored catalogue except for 17 Technical Instructions “Other – specify” entries. The generator emits a hyphen where the workbook and checked-in catalogue use an en dash. Keep stable stored values when fixing the generator.

## Photos

[Media library](../../../apps/web/app/media-library-workspace.tsx) and [photo detail](../../../apps/web/app/stored-photo-detail.tsx)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | Record ID | System-generated | Yes | Always | File document code / visual capture identity |
| 4 | 2 | Project | Auto-filled / dropdown | Yes | Always | Current authorized project context |
| 5 | 3 | Photo purpose | Dropdown | Yes | Always | Capture picker and detail classification. Save is possible without a purpose in the library. Classification does not transfer through the offline queue (F05). |
| 6 | 4 | Photo category | Dependent dropdown | Yes | After Photo purpose | Combined with work discipline and optional for two purposes. Ambiguous source (F06). |
| 7 | 5 | Work discipline | Dropdown | No | If photo relates to construction work | See row 4. Workbook list and instructions disagree (F06). |
| 8 | 6 | Work location | Structured dropdown + short text | Yes | Always | Library location/building and detail fields. Required structured location needs enforcement. |
| 9 | 7 | Photo date/time | Date/time default | Yes | Always | Capture metadata. Library applies first file last-modified timestamp to the whole batch (F05). |
| 10 | 8 | Photo upload | File upload / multiple files | Yes | Always | Batch upload exists. Library queues derived bytes as the saved file (F05). |
| 11 | 9 | Caption / observation | Short text | No | Always | Per-photo and shared caption on capture. |
| 12 | 10 | Related record | Linked-record selector | No | When applicable | Optional in saved photo classification; separate file links are available. Confirm canonical link behavior (F11). |
| 13 | 11 | Taken by | Auto-filled user | Yes | Always | Authenticated uploaded-by identity. Capture/display metadata requires runtime verification. |

## Works Ongoing

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L679)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | Record ID | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Report date | Date default | Yes | Always | Mapped — Report date. |
| 6 | 4 | Shift | Dropdown | No | Always | Mapped — Shift. |
| 7 | 5 | Work discipline | Dropdown | Yes | Always | Mapped — discipline (Work discipline, Secondary discipline). |
| 8 | 6 | Activity | Dependent dropdown | Yes | After Work discipline is selected | Mapped — Activity. |
| 9 | 7 | Building / area | Dropdown + optional text | Yes | Always | Mapped — Building / area. |
| 10 | 8 | Exact location / grid / level | Short text or location selector | Yes | Always | Mapped — Exact location / grid / level. |
| 11 | 9 | What exactly is being worked on? | Activity-specific dropdown / short text | Yes | After Activity | Mapped — What exactly is being worked on?. |
| 12 | 10 | Quantity completed | Number | Yes where measurable | Always; mark N/A only where the activity cannot reasonably be quantified | Mapped — quantity (Quantity completed, Quantity not measurable (N/A)). |
| 13 | 11 | Unit | Dropdown | Yes where quantity entered | When Quantity completed is entered | Mapped — Unit. |
| 14 | 12 | Progress status | Dropdown | Yes | Always | Mapped — Progress status. |
| 15 | 13 | Progress percentage | Number / slider | No | When useful for the activity | Mapped — Progress percentage. |
| 16 | 14 | Crew / contractor | Linked register dropdown | Yes | Always | Mapped — Crew / contractor. |
| 17 | 15 | Start / finish time | Time fields | No | If relevant to activity | Mapped — Start / finish time (Start time, Finish time, Work crosses midnight). |
| 18 | 16 | Activity-specific technical details | Conditional fields | No; required fields depend on activity | Show only the fields relevant to the selected activity | Mapped — Activity-specific technical details (Element, Element ID, Concrete grade / mix, Volume (mÂ³), Delivery ticket / batch references, Slump and cube sample references, Details for this activity). Concrete fields, one activity details text area for others. Guide prompts are hints, with no separate persisted value per prompt (F07). |
| 19 | 17 | Inspection / test reference | Linked record / short text | No | When inspection applies | Mapped — Inspection / test reference. |
| 20 | 18 | Photos | Multiple image upload | No | Always | Mapped — Photos. |
| 21 | 19 | Blocker / issue | Conditional dropdown + short text | No | If On Hold or blocker = Yes | Mapped — blocker (Blocker / issue, Linked issue or delay report). |
| 22 | 20 | Remarks | Short text | No | Always | Mapped — Remarks. |
| 23 | 21 | Reported by | Auto-filled user | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 28 | 22 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 29 | 23 | Workflow status | System-generated / read-only | System | When a workflow profile is active | Mapped — Workflow status. |

## Works Completed

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L700)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | Record ID | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Completion date | Date default | Yes | Always | Mapped — Completion date. |
| 6 | 4 | Work discipline | Dropdown | Yes | Always | Mapped — discipline (Work discipline, Secondary discipline). |
| 7 | 5 | Activity | Dependent dropdown | Yes | After Work discipline | Mapped — Activity. |
| 8 | 6 | Building / area | Dropdown + optional text | Yes | Always | Mapped — Building / area. |
| 9 | 7 | Exact location / grid / level | Location selector / short text | Yes | Always | Mapped — Exact location / grid / level. |
| 10 | 8 | What was completed? | Activity-dependent multi-select dropdown + conditional text | Yes | After Activity | Mapped — What was completed?. Guide completion options present. START HERE also calls for activity prompts (F07). |
| 11 | 9 | Quantity completed | Number | Yes where measurable | Always; allow N/A only where not measurable | Mapped — quantity (Quantity completed, Quantity not measurable (N/A)). |
| 12 | 10 | Unit | Dropdown | Yes where quantity entered | When Quantity completed is entered | Mapped — Unit. |
| 13 | 11 | Completion / inspection status | Dropdown | Yes | Always | Mapped — inspection (Completion / inspection status, Inspected by). Inspection decision in form. Rapid Verify does not advance this field (F02). |
| 14 | 12 | Inspection reference | Linked record selector | No | If inspected | Mapped — reference (Inspection reference, Linked NCR / issue). |
| 15 | 13 | Contractor / crew | Linked register dropdown | Yes | Always | Mapped — Contractor / crew. |
| 16 | 14 | Photo evidence | Multiple image upload | Recommended | Always | Mapped — Photo evidence. |
| 17 | 15 | Outstanding work / defects | Conditional short text + linked record | No | If not accepted or outstanding work exists | Mapped — Outstanding work / defects. |
| 18 | 16 | Remarks | Short text | No | Always | Mapped — Remarks. |
| 19 | 17 | Reported by | Auto-filled user | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 29 | 18 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 30 | 19 | Workflow status | System-generated / read-only | System | When a workflow profile is active | Mapped — Workflow status. |

## Project Delay Report

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L774)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | PDR number | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Delay start date/time | Date/time | Yes | Always | Mapped — Delay start date/time. |
| 6 | 4 | Reported date/time | Auto-filled date/time | Yes | Always | Server creation metadata distinct from the observed delay start. Display/runtime verification open. |
| 7 | 5 | Affected activity | Dropdown / linked work record | Yes | Always | Mapped — activity (Affected activity, Affected activity (not in the list)). |
| 8 | 6 | Location | Location dropdown | Yes | Always | Mapped — Location. |
| 9 | 7 | Delay cause type | Dropdown | Yes | Always | Mapped — Delay cause type. |
| 10 | 8 | Delay cause category | Dependent dropdown | Yes | After Delay cause type | Mapped — Delay cause category. |
| 11 | 9 | Detailed cause | Short text | Yes | Always | Mapped — Detailed cause. |
| 12 | 10 | Responsible party | Dropdown | No | Always | Mapped — Responsible party. |
| 13 | 11 | Delay duration | Number | Yes | Always | Mapped — duration (Delay duration, Duration is). |
| 14 | 12 | Duration unit | Dropdown | Yes | Always | Mapped — Duration unit. |
| 15 | 13 | Critical path impact | Dropdown | Yes | Always | Mapped — Critical path impact. |
| 16 | 14 | Schedule / milestone impact | Short text + linked milestone | No | If impact exists | Mapped — Schedule / milestone impact. |
| 17 | 15 | Mitigation / recovery action | Short text | Yes | Always | Mapped — Mitigation / recovery action. |
| 18 | 16 | Action owner | User / contractor dropdown | Yes | Always | Mapped — Action owner. |
| 19 | 17 | Target recovery date | Date | No | If recovery action is required | Mapped — Target recovery date. |
| 20 | 18 | Evidence | File upload | No | Always | Mapped — Evidence. Workbook optional. Annotated version requires original-date evidence and conditionally completion evidence. Current sheet path must be tested against both (F06). |
| 21 | 19 | Status | Dropdown | Yes | Always | Mapped — status (Status, Closure note and reviewer). |
| 26 | 20 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 27 | 21 | Workflow status | System-generated / read-only | System | When a workflow profile is active | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |

## Issue

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L591)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | Issue ID | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Date/time identified | Date/time default | Yes | Always | Mapped — Date/time identified. |
| 6 | 4 | Issue type | Dropdown | Yes | Always | Mapped — Issue type. |
| 7 | 5 | Category | Dependent dropdown | Yes | After Issue type | Mapped — Category. |
| 8 | 6 | Title | Short text | Yes | Always | Mapped — Title. |
| 9 | 7 | Description | Long text | Yes | Always | Mapped — Description. |
| 10 | 8 | Location | Location dropdown + detail | Yes | Always | Mapped — Location. |
| 11 | 9 | Discipline / work package | Dropdown | No | If relevant | Mapped — Discipline / work package. |
| 12 | 10 | Priority | Dropdown | Yes | Always | Mapped — Priority. |
| 13 | 11 | Impact type | Multi-select dropdown | No | Always | Mapped — Impact type. |
| 14 | 12 | Immediate action taken | Short text | No | If action taken | Mapped — Immediate action taken. |
| 15 | 13 | Responsible party | Contractor / user dropdown | Yes | Always | Mapped — responsible (Responsible party, Responsible person / company). Full workbook party list and name. Three-role screenshot conflicts (F06). |
| 16 | 14 | Corrective action required | Long text | Yes | Always | Mapped — Corrective action required. |
| 17 | 15 | Target completion date | Date | Yes | Always | Mapped — Target completion date. |
| 18 | 16 | Related record | Linked-record selector | No | If applicable | Mapped — Related record. |
| 19 | 17 | Attachments | File upload | No | Always | Mapped — Attachments. |
| 20 | 18 | Status | Dropdown | Yes | Always | Mapped — Status. |
| 21 | 19 | Resolution / closure note | Long text | Conditional | When status = Closed | Mapped — Resolution / closure note. |
| 22 | 20 | Reported by | Auto-filled user | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 27 | 21 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 28 | 22 | Workflow status | System-generated / read-only | System | When a workflow profile is active | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |

## HSE

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L634)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | HSE report ID | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Date/time observed | Date/time default | Yes | Always | Mapped — Date/time observed. |
| 6 | 4 | Issue type | Dropdown | Yes | Always | Mapped — Issue type. |
| 7 | 5 | Category | Dependent dropdown | Yes | After Issue type | Mapped — Category. |
| 8 | 6 | Title | Short text | Yes | Always | Mapped — Title. |
| 9 | 7 | Observation / hazard description | Long text | Yes | Always | Mapped — Observation / hazard description. |
| 10 | 8 | Location | Location dropdown + detail | Yes | Always | Mapped — Location. |
| 11 | 9 | Person / contractor involved | Linked register dropdown | No | If applicable | Mapped — Person / contractor involved. |
| 12 | 10 | Potential consequence | Multi-select dropdown | Yes | Always | Mapped — Potential consequence. |
| 13 | 11 | Risk likelihood | Dropdown | Yes | Always | Mapped — Risk likelihood. |
| 14 | 12 | Potential severity | Dropdown | Yes | Always | Mapped — Potential severity. |
| 15 | 13 | Risk rating | System-calculated or dropdown | Yes | After likelihood and severity | Mapped — Risk rating. Approved matrix when configured, controlled manual rating otherwise. Approval of project matrix required. |
| 16 | 14 | Immediate action taken | Long text | No | If action taken | Mapped — Immediate action taken. |
| 17 | 15 | Corrective / preventive action | Long text | Yes | Always | Mapped — Corrective / preventive action. |
| 18 | 16 | Action owner | User / contractor dropdown | Yes | Always | Mapped — Action owner. Workbook register-linked action owner replaces the crossed-out legacy selector and single text box (F06). |
| 19 | 17 | Due date | Date | Yes | Always | Mapped — Due date. |
| 20 | 18 | Photo evidence | Multiple image upload | Recommended | Always | Mapped — Photo evidence. |
| 21 | 19 | Related incident | Linked record | No | If applicable | Mapped — Related incident. |
| 22 | 20 | Status | Dropdown | Yes | Always | Mapped — status (Status, Verification / closure note). |
| 23 | 21 | Reported by | Auto-filled user | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 28 | 22 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 29 | 23 | Workflow status | System-generated / read-only | System | When a workflow profile is active | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |

## Materials Delivery

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L717)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | Delivery record ID | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Delivery date/time | Date/time | Yes | Always | Mapped — Delivery date/time. |
| 6 | 4 | Supplier | Linked register dropdown | Yes | Always | Mapped — Supplier. |
| 7 | 5 | Purchase order / requisition | Linked record / short text | Yes | Always | Mapped — Purchase order / requisition. |
| 8 | 6 | Delivery note number | Short text | No | If provided | Mapped — Delivery note number. |
| 9 | 7 | Material group | Dropdown | Yes | Always | Mapped — Material group. Cement and other material choices come from the Material Group family. |
| 10 | 8 | Material category | Dependent dropdown | Yes | After Material group | No standalone dependent row. Workbook taxonomy presents three families instead of group-specific categories (F06). |
| 11 | 9 | Material description / specification | Short text | Yes | Always | Mapped — Material description / specification. |
| 12 | 10 | Ordered quantity | Number | Yes | Always | Mapped — Ordered quantity. |
| 13 | 11 | Delivered quantity | Number | Yes | Always | Mapped — Delivered quantity. |
| 14 | 12 | Unit | Dropdown | Yes | Always | Mapped — Unit. Controlled dropdown. Shared and form-specific options differ (F06). |
| 15 | 13 | Delivery status | Dropdown | Yes | Always | Mapped — delivery_status (Delivery status, Revised delivery date). |
| 16 | 14 | Condition on arrival | Dropdown | Yes | Always | Mapped — Condition on arrival. |
| 17 | 15 | Inspection result | Dropdown | Yes | Always | Mapped — inspection (Inspection result, Inspection decided by). |
| 18 | 16 | Storage location | Location dropdown | No | If accepted and stored | Mapped — Storage location. |
| 19 | 17 | Discrepancy / remarks | Short text | Conditional | If exception exists | Mapped — discrepancy (Discrepancy / remarks, Discrepancy). |
| 20 | 18 | Photos / documents | File upload | No | Always | Mapped — Photos / documents. |
| 21 | 19 | Received by | Auto-filled user | Yes | Always | Mapped — Received by. |
| 26 | 20 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 27 | 21 | Workflow status | System-generated / read-only | System | When a workflow profile is active | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |

## Technical Instructions

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L735)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | Instruction ID | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Instruction date | Date default | Yes | Always | Mapped — Instruction date. |
| 6 | 4 | Instruction type | Dropdown | Yes | Always | Mapped — Instruction type. |
| 7 | 5 | Discipline | Dropdown | Yes | Always | Mapped — Discipline. |
| 8 | 6 | Category / subject | Dependent dropdown | Yes | After Discipline is selected | Mapped — Category / subject. |
| 9 | 7 | Location / element | Location selector + short text | Yes | Always | Mapped — Location / element. |
| 10 | 8 | Drawing / document reference | Short text / linked document | No | If applicable | Mapped — Drawing / document reference. Short text with revision hint. No canonical project-document revision link in the sheet slot (F11). |
| 11 | 9 | Instruction description | Long text | Yes | Always | Mapped — Instruction description. |
| 12 | 10 | Reason / background | Dropdown + short text | No | Always | Mapped — reason (Reason / background, Supporting explanation). |
| 13 | 11 | Issued to | Contractor / company dropdown | Yes | Always | Mapped — Issued to. |
| 14 | 12 | Action owner | User dropdown | Yes | Always | Mapped — Action owner. |
| 15 | 13 | Response required by | Date | No | If response is required | Mapped — Response required by. |
| 16 | 14 | Status | Dropdown | Yes | Always | Mapped — Status. |
| 17 | 15 | Attachments | File upload | No | Always | Mapped — Attachments. |
| 18 | 16 | Related record | Linked record selector | No | If applicable | Mapped — Related record. |
| 19 | 17 | Acknowledged by / date | User + date | Conditional | After status = Acknowledged or later | Mapped — Acknowledged by / date. Conditional auto field plus sign-off log. Check portal-to-record acknowledgement mapping (F01). |
| 20 | 18 | Closed / verified by | User dropdown | No | When completed | Mapped — Closed / verified by. |
| 25 | 19 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 26 | 20 | Workflow status | System-generated / read-only | System | When a workflow profile is active | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |

## Change Order

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L753)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | Change Order ID | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Request date | Date default | Yes | Always | Mapped — Request date. |
| 6 | 4 | Change type | Dropdown | Yes | Always | Mapped — Change type. |
| 7 | 5 | Change category | Dependent dropdown | Yes | After Change type is selected | Mapped — Change category. |
| 8 | 6 | Change title | Short text | Yes | Always | Mapped — Change title. |
| 9 | 7 | Change description | Long text | Yes | Always | Mapped — Change description. |
| 10 | 8 | Reason for change | Dropdown | Yes | Always | Mapped — Reason for change. Required workbook dropdown restored after client crossed out the older equivalent (F06). |
| 11 | 9 | Originator / requester | User or company dropdown | Yes | Always | Mapped — Originator / requester. |
| 12 | 10 | Location / work package | Location dropdown + short text | Yes | Always | Mapped — Location / work package. |
| 13 | 11 | Drawing / specification reference | Linked document / short text | No | If applicable | Mapped — Drawing / specification reference. Short text with revision hint. Canonical revision-link workflow incomplete (F11). |
| 14 | 12 | Quantity / unit | Number + unit dropdown | No | If applicable | Mapped — Quantity / unit (Added quantity, Omitted quantity, Unit). |
| 15 | 13 | Cost impact | Currency amount | Yes | Always | Mapped — cost (Cost impact, Currency). |
| 16 | 14 | Time impact | Number + unit | Yes | Always | Mapped — time (Time impact, Time unit). |
| 17 | 15 | Cost / schedule assessment | Long text / attachment | No | If impact exists | Mapped — Cost / schedule assessment. |
| 18 | 16 | Approval status | Dropdown | Yes | Always | Mapped — Approval status. |
| 19 | 17 | Approved amount / days | Numeric fields | Conditional | When approved | Mapped — Approved amount / days (Approved amount, Approved days). |
| 20 | 18 | Instruction to proceed | Dropdown | Yes | Always | Mapped — Instruction to proceed. Separate field from approval. Server enforcement of prerequisites needs end-to-end evidence (F01). |
| 21 | 19 | Related records | Linked-record selector | No | If applicable | Mapped — Related records. |
| 22 | 20 | Attachments | File upload | No | Always | Mapped — Attachments. |
| 23 | 21 | Prepared / reviewed / approved by | User dropdowns | Yes according to workflow | Always | Mapped — Prepared / reviewed / approved by (Approved by, Approval date). |
| 30 | 22 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 31 | 23 | Workflow status | System-generated / read-only | System | When a workflow profile is active | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |

## NCR

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L610)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | NCR number | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Date raised | Date/time default | Yes | Always | Mapped — Date raised. |
| 6 | 4 | NCR type | Dropdown | Yes | Always | Mapped — NCR type. Workbook NCR taxonomy. Legacy single-value Issue type removed. |
| 7 | 5 | Category | Dependent dropdown | Yes | After NCR type | Mapped — Category. |
| 8 | 6 | Title | Short text | Yes | Always | Mapped — Title. |
| 9 | 7 | Non-conformance description | Long text | Yes | Always | Mapped — Non-conformance description. |
| 10 | 8 | Discipline / work package | Dropdown | Yes | Always | Mapped — Discipline / work package. |
| 11 | 9 | Location / element | Location selector + short text | Yes | Always | Mapped — Location / element. |
| 12 | 10 | Requirement reference | Short text / linked document | Yes | Always | Mapped — Requirement reference. |
| 13 | 11 | Detected during | Dropdown | Yes | Always | Mapped — Detected during. |
| 14 | 12 | Related inspection | Linked record | No | If applicable | Mapped — Related inspection. |
| 15 | 13 | Severity / classification | Dropdown | Yes | Always | Mapped — Severity / classification. |
| 16 | 1 | Immediate containment | Multi-select dropdown | Yes | Always, when an NCR is registered | Mapped — containment (Immediate containment, Why no containment applies, Containment carried out). Workbook order cell says 1 between 13 and 15. Physical row is the containment row. |
| 17 | 15 | Disposition | Dropdown | Yes | Always | Mapped — Disposition. |
| 18 | 16 | Root cause category | Dropdown | No | After investigation | Mapped — Root cause category. |
| 19 | 17 | Root cause analysis | Long text | No | During investigation | Mapped — Root cause analysis. |
| 20 | 18 | Corrective action | Long text | Yes | Always | Mapped — Corrective action. |
| 21 | 19 | Action owner | User / contractor dropdown | Yes | Always | Mapped — Action owner. |
| 22 | 20 | Target completion date | Date | Yes | Always | Mapped — Target completion date. |
| 23 | 21 | Verification result | Dropdown | Conditional | Before closure | Mapped — Verification result. Reviewer result in form and separate verification workflow (F01). |
| 24 | 22 | Verified by / date | User + date | Conditional | Before closure | Mapped — Verified by / date (Verified by, Verified on). |
| 25 | 23 | Attachments | File upload | No | Always | Mapped — Attachments. |
| 26 | 24 | Status | Dropdown | Yes | Always | Mapped — Status. |
| 39 | 25 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 40 | 26 | Workflow status | System-generated / read-only | System | When a workflow profile is active | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |

## Lessons Learned

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L792)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | Lesson ID | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Date recorded | Date default | Yes | Always | Mapped — Date recorded. |
| 6 | 4 | Project phase | Dropdown | Yes | Always | Mapped — Project phase. |
| 7 | 5 | Lesson category | Dependent dropdown | Yes | After Project phase is selected | Mapped — Lesson category. |
| 8 | 6 | Title | Short text | Yes | Always | Mapped — Title. |
| 9 | 7 | Situation / context | Long text | Yes | Always | Mapped — Situation / context. |
| 10 | 8 | What happened? | Long text | Yes | Always | Mapped — What happened?. Workbook now uses its longer sequence. Screenshot requested four numbered stacked narratives (F06). |
| 11 | 9 | Impact / consequence | Multi-select + short text | Yes | Always | Mapped — impact (Impact / consequence, Actual consequence). |
| 12 | 10 | Root cause / contributing factors | Long text | No | If known | Mapped — Root cause / contributing factors. |
| 13 | 11 | Lesson learned | Long text | Yes | Always | Mapped — Lesson learned. |
| 14 | 12 | Recommendation / preventive action | Long text | Yes | Always | Mapped — Recommendation / preventive action. |
| 15 | 13 | Applicability | Dropdown | Yes | Always | Mapped — Applicability. |
| 16 | 14 | Discipline | Dropdown | No | If applicable | Mapped — Discipline. |
| 17 | 15 | Action owner | User / department dropdown | No | If action required | Mapped — Action owner. |
| 18 | 16 | Attachments | File upload | No | Always | Mapped — Attachments. Current sheet evidence slot. Verify behavior of earlier distinct issue/result photos (F06). |
| 19 | 17 | Review status | Dropdown | Yes | Always | Mapped — Review status. |
| 20 | 18 | Recorded by / reviewed by | Auto-filled + user dropdown | Yes / conditional | Always / on review | Mapped — Recorded by / reviewed by (Reviewed by). |
| 25 | 19 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 26 | 20 | Workflow status | System-generated / read-only | System | When a workflow profile is active | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |

## Agreements Made

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L810)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | Agreement ID | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Meeting / agreement date | Date/time | Yes | Always | Mapped — Meeting / agreement date. |
| 6 | 4 | Meeting / source | Dropdown + short text | No | Always | Mapped — source (Meeting / source, Meeting number / reference). |
| 7 | 5 | Agreement type | Dropdown | Yes | Always | Mapped — Agreement type. |
| 8 | 6 | Agreement category | Dependent dropdown | Yes | After Agreement type is selected | Mapped — Agreement category. |
| 9 | 7 | Agreement / decision title | Short text | Yes | Always | Mapped — Agreement / decision title. |
| 10 | 8 | Agreement details | Long text | Yes | Always | Mapped — Agreement details. |
| 11 | 9 | Agreed by | Multi-select user / company dropdown | Yes | Always | Mapped — Agreed by. |
| 12 | 10 | Action required | Dropdown | Yes | Always | Mapped — Action required. |
| 13 | 11 | Action owner | User / contractor dropdown | Conditional | If Action required = Yes | Mapped — Action owner. Conditional UI and separate action. Offline and follow-up consistency gap (F08). |
| 14 | 12 | Due date | Date | Conditional | If Action required = Yes | Mapped — Due date. Conditional due date. Same follow-up consistency gap (F08). |
| 15 | 13 | Related discipline / location | Dropdown + location selector | No | If applicable | Mapped — Related discipline / location (Related discipline, Related location). |
| 16 | 14 | Related record | Linked record selector | No | If applicable | Mapped — Related record. |
| 17 | 15 | Status | Dropdown | Yes | Always | Mapped — Status. |
| 18 | 16 | Evidence / minutes | File upload | No | Always | Mapped — Evidence / minutes. |
| 19 | 17 | Confirmation / closure note | Short text | No | When status changes | Mapped — Confirmation / closure note. |
| 20 | 18 | Recorded by | Auto-filled user | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 25 | 19 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 26 | 20 | Workflow status | System-generated / read-only | System | When a workflow profile is active | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |

## HSE Incident Registration

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L654)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | Incident ID | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Incident date/time | Date/time | Yes | Always | Mapped — Incident date/time. |
| 6 | 4 | Reported date/time | Auto-filled date/time | Yes | Always | Server creation metadata distinct from incident time. Display/runtime verification open. |
| 7 | 5 | Incident type | Dropdown | Yes | Always | Mapped — Incident type. |
| 8 | 6 | Incident category | Dependent dropdown | Yes | After Incident type | Mapped — Incident category. |
| 9 | 7 | Incident title | Short text | Yes | Always | Mapped — Incident title. |
| 10 | 8 | Detailed event description | Long text | Yes | Always | Mapped — Detailed event description. |
| 11 | 9 | Exact location | Location dropdown + detail | Yes | Always | Mapped — Exact location. |
| 12 | 10 | People involved / affected | Linked user / contractor register | Conditional | If people involved | Mapped — People involved / affected. |
| 13 | 11 | Injury classification | Dropdown | Conditional | If injury/illness | Mapped — Injury classification. |
| 14 | 12 | Nature of injury / illness | Dropdown + short text | Conditional | If injury/illness | Mapped — Nature of injury / illness. |
| 15 | 13 | Body part affected | Dropdown | Conditional | If injury/illness | Mapped — Body part affected. |
| 16 | 14 | Environmental impact | Dropdown | Conditional | If environmental event | Mapped — Environmental impact. |
| 17 | 15 | Property / equipment damage | Dropdown + short text | Conditional | If damage occurred | Mapped — damage (Property / equipment damage, Affected asset and estimated impact). |
| 18 | 16 | Immediate response | Long text | Yes | Always | Mapped — Immediate response. |
| 19 | 17 | Authorities / client notified | Dropdown + date/time | No | If notification required | Mapped — notified (Authorities / client notified, Notification log). |
| 20 | 18 | Witnesses | Linked user / contact register | No | If witnesses | Mapped — Witnesses. |
| 21 | 19 | Potential / actual severity | Dropdown | Yes | Always | Mapped — Potential / actual severity. |
| 22 | 20 | Investigation required | Dropdown | Yes | Always | Mapped — Investigation required. |
| 23 | 21 | Investigation findings / root cause | Long text | Conditional | If investigation required | Mapped — Investigation findings / root cause. |
| 24 | 22 | Corrective / preventive actions | Action list | Yes | Always | Mapped — Corrective / preventive actions. Repeatable rows. Saving the incident and creating actions are separate operations (F08). |
| 25 | 23 | Photo / document evidence | Multiple file upload | No | Always | Mapped — Photo / document evidence. |
| 26 | 24 | Related HSE observation | Linked record | No | If applicable | Mapped — Related HSE observation. |
| 27 | 25 | Status | Dropdown | Yes | Always | Mapped — status (Status, Closure note). |
| 28 | 26 | Reported by / HSE reviewer | Auto-filled + user dropdown | Yes | Always | Mapped — Reported by / HSE reviewer (HSE reviewer). Reporter and HSE reviewer. Sensitive incident data has its own access rules. |
| 33 | 27 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 34 | 28 | Workflow status | System-generated / read-only | System | When a workflow profile is active | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |

## Shared Dropdown Lists

Lists occupy Excel rows 2–18. Local source is [the catalogue and project defaults](../../../apps/web/lib/forms/spec-forms.ts#L72).

| Excel row | List | Source use and audit result |
|---:|---|---|
| 2 | Priority | Issue and escalation. Code derives urgency for Critical. Project policy still needs acceptance. |
| 3 | Shift | Workforce and Works Ongoing. Other asks for a label. |
| 4 | Progress status | Works Ongoing progress differs from review status. |
| 5 | Unit | Work forms and delivery expose configurable units. Form sheets omit mm/cm while this shared sheet includes them (F06). |
| 6 | Risk likelihood | HSE uses likelihood and configurable definitions. |
| 7 | Potential severity | HSE uses severity and configurable definitions. |
| 8 | Attendance status | Workforce crew lines. Compare headcount and hours for every non-present status. |
| 9 | Competency / authorization status | Workforce crew lines. Test expired/noncompliant values through export. |
| 10 | Duration unit | Delay and change-order timing use controlled units. |
| 11 | Impact type | Issue uses a multi-select. |
| 12 | Responsible party | Issue and PDR share the workbook catalogue. Issue screenshot requests three terms (F06). |
| 13 | Completion / inspection status | Works Completed options exist. Rapid Verify persistence gap (F02). |
| 14 | Photo purpose | Photos purpose/detail paths. Capture and offline persistence gaps (F05, F06). |
| 15 | NCR Type / Category | NCR local dependent catalogue. |
| 16 | Change Order Type / Category | CO local dependent catalogue. |
| 17 | Agreements Type / Category | Agreements local dependent catalogue. |
| 18 | Lessons Learned Project Phase / Category | Lessons Learned local dependent catalogue. |

## Activity Detail Guide

Every activity key and the location of its source row are listed below. The generated catalogue includes description, completion list and prompt text. The worksheet also carries notes in columns F/G. The generator reads only A–E. The forms do not persist one answer per guide prompt (F07).

| Excel row | Discipline | Activity | Completion choices | Prompts |
|---:|---|---|---:|---:|
| 2 | Preliminaries & Site Establishment | Site Clearing & Preparation | 4 | 5 |
| 3 | Preliminaries & Site Establishment | Demolition & Removal | 4 | 5 |
| 4 | Preliminaries & Site Establishment | Temporary Facilities | 8 | 5 |
| 5 | Preliminaries & Site Establishment | Temporary Utilities | 8 | 5 |
| 6 | Preliminaries & Site Establishment | Site Fencing & Hoarding | 7 | 5 |
| 7 | Preliminaries & Site Establishment | Mobilization | 8 | 5 |
| 8 | Preliminaries & Site Establishment | Site Logistics & Access | 8 | 5 |
| 9 | Surveying & Setting Out | Topographic Survey | 6 | 5 |
| 10 | Surveying & Setting Out | Building / Grid Setting Out | 6 | 5 |
| 11 | Surveying & Setting Out | Level & Benchmark Transfer | 6 | 5 |
| 12 | Surveying & Setting Out | Utility / Services Survey | 6 | 5 |
| 13 | Surveying & Setting Out | As-Built Survey | 6 | 5 |
| 14 | Earthworks & Ground Improvement | Topsoil Stripping | 7 | 6 |
| 15 | Earthworks & Ground Improvement | Bulk Excavation | 7 | 6 |
| 16 | Earthworks & Ground Improvement | Trench Excavation | 7 | 6 |
| 17 | Earthworks & Ground Improvement | Foundation Excavation | 7 | 6 |
| 18 | Earthworks & Ground Improvement | Rock Excavation | 7 | 6 |
| 19 | Earthworks & Ground Improvement | Dewatering | 7 | 6 |
| 20 | Earthworks & Ground Improvement | Filling & Backfilling | 7 | 6 |
| 21 | Earthworks & Ground Improvement | Subgrade Preparation | 7 | 6 |
| 22 | Earthworks & Ground Improvement | Soil Stabilization | 7 | 6 |
| 23 | Earthworks & Ground Improvement | Ground Improvement | 7 | 5 |
| 24 | Earthworks & Ground Improvement | Compaction & Testing | 7 | 6 |
| 25 | Foundations & Substructure | Piling | 5 | 5 |
| 26 | Foundations & Substructure | Pile Testing | 4 | 5 |
| 27 | Foundations & Substructure | Pile Caps & Ground Beams | 4 | 6 |
| 28 | Foundations & Substructure | Pad / Strip Footings | 4 | 6 |
| 29 | Foundations & Substructure | Raft / Mat Foundation | 4 | 6 |
| 30 | Foundations & Substructure | Basement Construction | 4 | 5 |
| 31 | Foundations & Substructure | Foundation Waterproofing | 7 | 6 |
| 32 | Foundations & Substructure | Underground Retaining Structures | 4 | 5 |
| 33 | Concrete & Reinforced Concrete | Blinding / Lean Concrete | 9 | 6 |
| 34 | Concrete & Reinforced Concrete | Formwork & Falsework | 7 | 5 |
| 35 | Concrete & Reinforced Concrete | Reinforcement Fixing | 7 | 6 |
| 36 | Concrete & Reinforced Concrete | Embedded Items & Cast-In Components | 4 | 5 |
| 37 | Concrete & Reinforced Concrete | Concrete Pouring | 9 | 6 |
| 38 | Concrete & Reinforced Concrete | Concrete Finishing | 9 | 6 |
| 39 | Concrete & Reinforced Concrete | Concrete Curing & Protection | 4 | 6 |
| 40 | Concrete & Reinforced Concrete | Precast Concrete Installation | 9 | 6 |
| 41 | Concrete & Reinforced Concrete | Concrete Repair | 9 | 6 |
| 42 | Concrete & Reinforced Concrete | Concrete Cutting / Coring | 9 | 6 |
| 43 | Concrete & Reinforced Concrete | Concrete Testing | 9 | 6 |
| 44 | Structural Steel & Metal Works | Steel Fabrication | 4 | 6 |
| 45 | Structural Steel & Metal Works | Steel Erection | 4 | 6 |
| 46 | Structural Steel & Metal Works | Bolting & Connections | 4 | 6 |
| 47 | Structural Steel & Metal Works | Welding | 4 | 6 |
| 48 | Structural Steel & Metal Works | Metal Decking | 4 | 5 |
| 49 | Structural Steel & Metal Works | Metal Stairs, Platforms & Handrails | 4 | 5 |
| 50 | Structural Steel & Metal Works | Protective Coating / Fireproofing | 7 | 6 |
| 51 | Structural Steel & Metal Works | Steel Inspection | 4 | 6 |
| 52 | Masonry & Wall Construction | Concrete Blockwork | 7 | 6 |
| 53 | Masonry & Wall Construction | Brickwork | 7 | 5 |
| 54 | Masonry & Wall Construction | Reinforced Masonry | 7 | 5 |
| 55 | Masonry & Wall Construction | AAC / Lightweight Blockwork | 7 | 5 |
| 56 | Masonry & Wall Construction | Lintels & Wall Openings | 7 | 5 |
| 57 | Masonry & Wall Construction | Wall Chasing & Making Good | 4 | 5 |
| 58 | Architectural & Interior Finishes | Plastering / Rendering | 4 | 6 |
| 59 | Architectural & Interior Finishes | Screeding | 5 | 5 |
| 60 | Architectural & Interior Finishes | Floor Tiling | 5 | 6 |
| 61 | Architectural & Interior Finishes | Wall Tiling | 5 | 6 |
| 62 | Architectural & Interior Finishes | Stone / Terrazzo Finishes | 5 | 5 |
| 63 | Architectural & Interior Finishes | Resilient / Carpet Flooring | 5 | 6 |
| 64 | Architectural & Interior Finishes | Ceiling Installation | 4 | 6 |
| 65 | Architectural & Interior Finishes | Drywall & Partitions | 4 | 6 |
| 66 | Architectural & Interior Finishes | Doors & Frames | 6 | 6 |
| 67 | Architectural & Interior Finishes | Windows & Glazing | 6 | 6 |
| 68 | Architectural & Interior Finishes | Painting & Decorating | 7 | 6 |
| 69 | Architectural & Interior Finishes | Joinery & Cabinetry | 6 | 5 |
| 70 | Architectural & Interior Finishes | Cladding & Facade Finishes | 7 | 6 |
| 71 | Architectural & Interior Finishes | Acoustic / Thermal Insulation | 7 | 5 |
| 72 | Architectural & Interior Finishes | Sealants & Movement Joints | 7 | 6 |
| 73 | Waterproofing & Roofing | Roof Structure | 7 | 6 |
| 74 | Waterproofing & Roofing | Roof Sheets & Coverings | 7 | 6 |
| 75 | Waterproofing & Roofing | Roof Membrane | 7 | 6 |
| 76 | Waterproofing & Roofing | Roof Insulation & Vapour Barrier | 7 | 6 |
| 77 | Waterproofing & Roofing | Roof Flashings & Rainwater Goods | 7 | 6 |
| 78 | Waterproofing & Roofing | Wet Area Waterproofing | 7 | 6 |
| 79 | Waterproofing & Roofing | Below-Ground Waterproofing | 7 | 6 |
| 80 | Waterproofing & Roofing | Waterproofing Testing | 7 | 6 |
| 81 | Mechanical & HVAC Services | HVAC Ductwork | 7 | 6 |
| 82 | Mechanical & HVAC Services | Air-Conditioning Equipment | 7 | 5 |
| 83 | Mechanical & HVAC Services | Ventilation & Exhaust | 7 | 5 |
| 84 | Mechanical & HVAC Services | Refrigerant Piping | 7 | 5 |
| 85 | Mechanical & HVAC Services | Mechanical Piping | 7 | 6 |
| 86 | Mechanical & HVAC Services | Pumps & Mechanical Equipment | 7 | 6 |
| 87 | Mechanical & HVAC Services | Insulation & Cladding | 7 | 6 |
| 88 | Mechanical & HVAC Services | HVAC Testing & Balancing | 7 | 6 |
| 89 | Plumbing, Sanitary & Drainage Services | Domestic Water Supply | 8 | 6 |
| 90 | Plumbing, Sanitary & Drainage Services | Sanitary Plumbing | 8 | 6 |
| 91 | Plumbing, Sanitary & Drainage Services | Stormwater Pipework | 8 | 6 |
| 92 | Plumbing, Sanitary & Drainage Services | Sanitary Fixtures | 8 | 5 |
| 93 | Plumbing, Sanitary & Drainage Services | Water Heaters & Storage Tanks | 8 | 6 |
| 94 | Plumbing, Sanitary & Drainage Services | Pumps & Booster Sets | 7 | 5 |
| 95 | Plumbing, Sanitary & Drainage Services | Pipe Pressure / Leakage Testing | 8 | 6 |
| 96 | Plumbing, Sanitary & Drainage Services | External Sewer / Water Connections | 8 | 6 |
| 97 | Electrical & ELV Services | Electrical Conduits & Containment | 9 | 6 |
| 98 | Electrical & ELV Services | Cable Pulling & Termination | 9 | 6 |
| 99 | Electrical & ELV Services | Distribution Boards & Panels | 4 | 5 |
| 100 | Electrical & ELV Services | Lighting Installation | 9 | 5 |
| 101 | Electrical & ELV Services | Small Power & Socket Outlets | 9 | 5 |
| 102 | Electrical & ELV Services | Earthing & Bonding | 9 | 5 |
| 103 | Electrical & ELV Services | Generator / UPS Installation | 9 | 5 |
| 104 | Electrical & ELV Services | Lightning Protection | 9 | 5 |
| 105 | Electrical & ELV Services | Data & Telecommunications | 9 | 5 |
| 106 | Electrical & ELV Services | CCTV / Access Control / Security | 9 | 5 |
| 107 | Electrical & ELV Services | Electrical Testing & Certification | 9 | 6 |
| 108 | Fire Protection & Life Safety | Fire Alarm System | 8 | 6 |
| 109 | Fire Protection & Life Safety | Fire Sprinkler Pipework | 8 | 6 |
| 110 | Fire Protection & Life Safety | Fire Hose Reel / Hydrant System | 8 | 6 |
| 111 | Fire Protection & Life Safety | Fire Pumps & Tanks | 7 | 6 |
| 112 | Fire Protection & Life Safety | Fire Extinguishers & Signage | 8 | 6 |
| 113 | Fire Protection & Life Safety | Smoke Control / Pressurization | 8 | 5 |
| 114 | Fire Protection & Life Safety | Fire Stopping | 8 | 6 |
| 115 | Fire Protection & Life Safety | Fire System Testing | 8 | 6 |
| 116 | External Civil Works & Infrastructure | Road Formation & Subbase | 8 | 5 |
| 117 | External Civil Works & Infrastructure | Road Base & Asphalt | 8 | 5 |
| 118 | External Civil Works & Infrastructure | Concrete Roads / Pavements | 8 | 6 |
| 119 | External Civil Works & Infrastructure | Kerbs & Channels | 8 | 5 |
| 120 | External Civil Works & Infrastructure | Paving & Interlocking Blocks | 8 | 5 |
| 121 | External Civil Works & Infrastructure | Stormwater Channels & Culverts | 8 | 6 |
| 122 | External Civil Works & Infrastructure | Retaining Walls | 8 | 5 |
| 123 | External Civil Works & Infrastructure | Bridges / Access Structures | 8 | 5 |
| 124 | External Civil Works & Infrastructure | Road Markings & Signage | 8 | 5 |
| 125 | External Civil Works & Infrastructure | External Concrete Works | 4 | 6 |
| 126 | Utilities & External Services | External Water Mains | 4 | 6 |
| 127 | Utilities & External Services | External Sewer Networks | 8 | 6 |
| 128 | Utilities & External Services | External Electrical Ducts & Cables | 7 | 6 |
| 129 | Utilities & External Services | Telecommunications Ducts | 7 | 6 |
| 130 | Utilities & External Services | Gas / Fuel Services | 4 | 5 |
| 131 | Utilities & External Services | Utility Diversion / Protection | 6 | 5 |
| 132 | Utilities & External Services | Utility Testing & Connection | 6 | 5 |
| 133 | Landscaping & External Works | Topsoil Placement | 7 | 6 |
| 134 | Landscaping & External Works | Planting & Turfing | 7 | 5 |
| 135 | Landscaping & External Works | Irrigation Systems | 7 | 5 |
| 136 | Landscaping & External Works | Landscape Structures | 7 | 5 |
| 137 | Landscaping & External Works | External Furniture & Fixtures | 7 | 5 |
| 138 | Landscaping & External Works | Landscape Maintenance | 7 | 5 |
| 139 | Testing, Commissioning & Handover | Pre-Commissioning Checks | 8 | 5 |
| 140 | Testing, Commissioning & Handover | Functional Testing | 8 | 5 |
| 141 | Testing, Commissioning & Handover | Integrated Systems Testing | 8 | 5 |
| 142 | Testing, Commissioning & Handover | Balancing & Performance Testing | 8 | 5 |
| 143 | Testing, Commissioning & Handover | Defect Rectification / Snagging | 8 | 5 |
| 144 | Testing, Commissioning & Handover | Cleaning & Final Preparation | 8 | 5 |
| 145 | Testing, Commissioning & Handover | Training & Demonstration | 8 | 5 |
| 146 | Testing, Commissioning & Handover | As-Built / O&M Documentation | 8 | 5 |
| 147 | Testing, Commissioning & Handover | Final Handover | 8 | 5 |
| 148 | Testing, Commissioning & Handover | Demobilization | 8 | 5 |

## Sign-off Workflow

[Profile definitions](../../../apps/web/lib/forms/signoff.ts#L54) and [database workflow](../../../supabase/migrations/202611210001_spec_registers_and_signoff_truth.sql#L550).

| Excel rows | Scope | Evidence and remaining checks |
|---|---|---|
| 2–5 | Append-only event log, fields and actions | Implemented with separate form, portal and verification event stores. Unified state and journey acceptance remain open (F01). |
| 6–7 | Acknowledgement and identity | Attestation methods, server timestamps and uploaded evidence exist. Validate identity metadata and project signatory/legal rules. |
| 8–9 | Return, resubmit and frozen versions | Versions and rounds in sign-off RPC. Compare portal round transitions and updates after approval. |
| 10–11 | Authority, limits and notifications | Permission checks, parallel approval thresholds, delegations, reminders. Verify each configured restriction end to end. |
| 12 | Record presentation and export | Sign-off panel, per-form export paths, day export. Searchable global history and unified event coverage are partial (F01, F04). |
| 14 | Works Ongoing / WO-DAILY | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 15 | Works Completed / WC-COMPLETION | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 16 | Workforce / WF-ATTENDANCE | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 17 | Project Delay Report / PDR-REVIEW | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 18 | Issue / ISSUE-CLOSEOUT | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 19 | HSE / HSE-OBSERVATION | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 20 | Materials Delivery / MAT-RECEIPT | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 21 | Inspections / INSPECTION-WITNESS | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 22 | Technical Instructions / TECH-INSTRUCTION | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 23 | Change Order / CHANGE-APPROVAL | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 24 | NCR / NCR-CORRECTIVE | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 25 | Agreements Made / AGREEMENT-ACK | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 26 | Lessons Learned / LESSON-REVIEW | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 27 | HSE Incident Registration / HSE-INCIDENT | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 30–31 | Mandatory comments and immutability | Common comment rules cover return, reject, withdraw and reopen. Other responsibility/approval changes need rule-by-rule review (F01). |
| 32–35 | Multiple signatures, parallel review, external evidence and configuration | Thresholds, role captions, named approvers, due days, delegation and an approval limit. Full stage order and action model are defined in code (F01/F12). |
| 36 | Legal effect | Requires CODECO’s project procedure. Acknowledgement is described independently from approval. |

## START HERE

| Excel rows | Trace |
|---|---|
| 2–5 | Form sheets govern screen order and form-specific classification. Generated catalogue and field trace above. Photos and delivery ambiguities in F06. |
| 6–9 | Shared Works lists, activity guide, dependency resets and Other. Key/reset implementation exists. Prompt persistence and full conditional coverage in F07. |
| 10–12 | Live registers, required/conditional fields, multi-select exclusivity. UI helpers exist. Database parity incomplete (F03). |
| 13–15 | Authority and audit events, configuration and retention of historical labels. Review F01 and F12. |
| 16–20 | Go-live UAT, consolidated source, multiple signature rounds and CODECO decisions. See audit acceptance and decision lists. |
| 21 | TI instruction type independent of discipline and category filtered by discipline. Three fields mapped in TI rows 4–6. |
