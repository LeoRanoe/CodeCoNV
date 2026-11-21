-- F03 (client-spec audit): the server enforces each workbook form's unconditional rules.
--
-- app_private.spec_form_rules() is generated from apps/web/lib/forms/spec-forms.ts by
-- apps/web/scripts/generate-spec-server-rules.mjs (tests/spec-server-rules.test.mjs keeps them equal):
-- the always-required fields and rows, and the values of fixed dropdowns, multi-selects and
-- dependent lists. Conditional requirements stay in the form; project-configurable lists are not
-- checked here.
--
-- * Every save by a signed-in user: a fixed-list value that changed must be one of the list's
--   values (stored values that did not change are left as they are, so older records stay editable).
-- * A save from the current form (its spec carries "_rules"): the always-required fields too.
--   Older offline payloads without the marker are not stopped in the queue; their formal submission is.
-- * A formal submission or resubmission (record_signoff_action): every rule, on the stored record.
-- Drafts are kept on the device by the form; nothing here deletes or rewrites stored data.
-- The six workbook decisions of 23-11-2026 (Change Order reason required, the ten Issue responsible
-- parties, a register Action owner on HSE observations, the Lessons Learned order, optional PDR
-- evidence, NCR type and category first) are the rules of this table.

create or replace function app_private.spec_form_rules()
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $rules$
  select '{"issue":{"required":["identified_at","issue_type","issue_category","responsible_party","priority","corrective_action","target_date"],"rows":[],"options":{"issue_type":["Quality","Equipment","Materials","Schedule","Operational","Technical / Design","Commercial / Contractual"],"discipline":["Preliminaries & Site Establishment","Surveying & Setting Out","Earthworks & Ground Improvement","Foundations & Substructure","Concrete & Reinforced Concrete","Structural Steel & Metal Works","Masonry & Wall Construction","Architectural & Interior Finishes","Waterproofing & Roofing","Mechanical & HVAC Services","Plumbing, Sanitary & Drainage Services","Electrical & ELV Services","Fire Protection & Life Safety","External Civil Works & Infrastructure","Utilities & External Services","Landscaping & External Works","Testing, Commissioning & Handover"],"responsible_party":["Client","Consultant","Main Contractor","Subcontractor","Supplier","Utility Provider","Authority","Weather","Shared","Undetermined"],"priority":["Low","Medium","High","Critical"],"impact_types":["Cost","Schedule","Quality","Scope","Resources","Client","Other"]},"dependent":{"issue_category":{"parent":"issue_type","groups":{"Quality":["Workmanship","Concrete Works","Reinforcement Works","Structural Works","Welding & Fabrication","Masonry Works","Waterproofing","Painting & Finishing","Dimensional Accuracy","Installation Works","Material Quality","Inspection / Testing Failure","Drawing / Specification Deviation","Non-Conformance (NCR)"],"Equipment":["Equipment Breakdown","Equipment Availability","Preventive Maintenance","Corrective Maintenance","Equipment Damage","Equipment Performance","Tools & Small Equipment","Calibration","Inspection / Certification","Spare Parts"],"Materials":["Material Shortage","Delayed Delivery","Incorrect Materials","Damaged Materials","Material Quality","Storage & Handling","Inventory Management","Material Wastage","Procurement / Ordering","Supplier Performance","Material Approval","Material Expiry"],"Schedule":["Activity Delay","Milestone Delay","Critical Path Delay","Manpower Shortage","Subcontractor Delay","Material Delivery Delay","Equipment Availability Delay","Weather Impact","Drawing / Information Delay","Approval / Permit Delay","Work Sequencing","Rework","Site Access Delay"],"Operational":["Manpower Allocation","Communication","Coordination","Site Logistics","Site Access","Utilities","Site Facilities","Documentation","Subcontractor Management","Client / Consultant Coordination","Resource Allocation","Decision Required"],"Technical / Design":["Drawing Discrepancy","Design Error / Omission","Technical Query (RFI)","Design Change","Interdisciplinary Clash","Specification Clarification","Constructability"],"Commercial / Contractual":["Variation / Change Order","Cost Impact","Payment / Certification","Contractual Notice / Claim","Scope Clarification","Budget / Cost Control"]}}},"labels":{"identified_at":"Date/time identified","issue_type":"Issue type","issue_category":"Category","discipline":"Discipline / work package","responsible_party":"Responsible party","priority":"Priority","impact_types":"Impact type","immediate_action":"Immediate action taken","corrective_action":"Corrective action required","target_date":"Target completion date","related_record":"Related record","closure_note":"Resolution / closure note"}},"ncr":{"required":["raised_at","ncr_type","ncr_category","discipline","requirement_reference","detected_during","severity","containment","disposition","corrective_action","action_owner","target_date"],"rows":[],"options":{"ncr_type":["Workmanship","Materials & Products","Design & Drawings","Specifications & Standards","Installation & Assembly","Testing & Inspection","Process & Procedures","Survey & Dimensional Control","Documentation & Traceability","Equipment & Plant"],"discipline":["Preliminaries & Site Establishment","Surveying & Setting Out","Earthworks & Ground Improvement","Foundations & Substructure","Concrete & Reinforced Concrete","Structural Steel & Metal Works","Masonry & Wall Construction","Architectural & Interior Finishes","Waterproofing & Roofing","Mechanical & HVAC Services","Plumbing, Sanitary & Drainage Services","Electrical & ELV Services","Fire Protection & Life Safety","External Civil Works & Infrastructure","Utilities & External Services","Landscaping & External Works","Testing, Commissioning & Handover"],"detected_during":["Incoming Material Inspection","In-Process Inspection","Final Inspection","Testing","Site Observation","Audit","Other"],"severity":["Minor","Major","Critical"],"containment":["Stop affected work / suspend activity","Isolate or quarantine nonconforming materials","Segregate affected work or products","Prevent use or installation of affected materials","Remove defective work from service / restrict access","Provide temporary protection or safety measures","Implement temporary repair / make-safe measure","Increase inspection, testing or monitoring","Notify responsible supervisor / contractor / consultant","Other","Not applicable (justification required)"],"disposition":["Rework","Repair","Use As Is (with approved concession)","Reject / Replace","Scrap","Further Technical Evaluation Required"],"root_cause_category":["Method","People","Material","Equipment","Design","Measurement","Supplier","Other"],"verification_result":["Effective","Not Effective","Rework Required","Pending"]},"dependent":{"ncr_category":{"parent":"ncr_type","groups":{"Workmanship":["Poor Workmanship / Finish","Incorrect Work Method","Incomplete Work","Damage to Completed Work","Defective Joint / Connection","Poor Surface Preparation"],"Materials & Products":["Incorrect Material / Product","Material Outside Specification","Damaged Material / Product","Expired / Shelf-Life Exceeded","Missing Material Certification","Incorrect Storage / Handling"],"Design & Drawings":["Design Error / Omission","Work Not to Approved Drawing","Obsolete / Incorrect Drawing Revision","Unresolved Design Conflict","Unapproved Design Change"],"Specifications & Standards":["Specification Non-Compliance","Code / Standard Non-Compliance","Incorrect Acceptance Criteria","Unapproved Material / Substitution"],"Installation & Assembly":["Incorrect Installation","Incorrect Position / Orientation","Incomplete Installation","Incorrect Connection / Fixing","System Interface / Coordination Failure"],"Testing & Inspection":["Failed Inspection","Failed Test Result","Required Test Not Performed","Incorrect Test Method","Test Equipment / Calibration Issue","Inspection Hold Point Bypassed"],"Process & Procedures":["Method Statement Not Followed","Inspection & Test Plan Not Followed","Unapproved Procedure Used","Process Parameter Outside Limits","Required Quality Control Omitted"],"Survey & Dimensional Control":["Incorrect Setting Out","Level / Elevation Out of Tolerance","Alignment / Plumbness Out of Tolerance","Dimension / Geometry Out of Tolerance","Incorrect Coordinates / Grid Reference"],"Documentation & Traceability":["Missing Quality Record","Incomplete / Incorrect Record","Missing Traceability","Missing Approval / Authorization","Missing As-Built Information"],"Equipment & Plant":["Unsuitable Equipment Used","Equipment Condition Non-Compliance","Equipment Calibration / Certification Invalid","Equipment Setup / Configuration Incorrect"]}}},"labels":{"raised_at":"Date raised","ncr_type":"NCR type","ncr_category":"Category","discipline":"Discipline / work package","requirement_reference":"Requirement reference","detected_during":"Detected during","related_inspection":"Related inspection","severity":"Severity / classification","containment":"Immediate containment","containment_justification":"Why no containment applies","containment_details":"Containment carried out","disposition":"Disposition","root_cause_category":"Root cause category","root_cause_analysis":"Root cause analysis","corrective_action":"Corrective action","action_owner":"Action owner","target_date":"Target completion date","verification_result":"Verification result"}},"hse":{"required":["observed_at","hse_type","hse_category","potential_consequences","risk_likelihood","risk_severity","corrective_action","action_owner","due_date"],"rows":[],"options":{"hse_type":["Safety","Health","Environment","Unsafe Act","Unsafe Condition","HSE Observation"],"potential_consequences":["Injury","Illness","Property Damage","Fire","Environmental Harm","Public Impact","Other","Not Applicable"]},"dependent":{"hse_category":{"parent":"hse_type","groups":{"Safety":["Personal Protective Equipment (PPE)","Working at Heights","Scaffolding & Ladders","Fall Protection","Electrical Safety","Fire Prevention & Protection","Hot Work","Lifting Operations & Rigging","Excavation & Trenching","Confined Space","Tools & Machinery Safety","Traffic & Vehicle Safety","Housekeeping","Slips, Trips & Falls","Barricades & Safety Signage","Permit to Work","Emergency Preparedness"],"Health":["Heat Stress & Dehydration","Fatigue & Workload","Dust Exposure","Noise Exposure","Chemical Exposure","Respiratory Protection","Ergonomics & Manual Handling","Biological Hazards","Skin & Eye Protection","Sanitation & Hygiene","Drinking Water & Food Hygiene","First Aid & Medical Facilities"],"Environment":["Oil & Fuel Storage / Leakage","Chemical Storage & Handling","Hazardous Waste Management","General Waste Management","Wastewater Management","Soil Contamination","Water Pollution Prevention","Air Emissions & Dust Control","Noise & Vibration","Erosion & Sediment Control","Stormwater & Drainage","Vegetation & Habitat Protection","Wildlife Protection","Environmental Permits & Controls"],"Unsafe Act":["Failure to Wear PPE","Improper Use of Tools / Equipment","Unauthorized Equipment Operation","Working at Heights Without Protection","Failure to Follow Procedure","Unsafe Lifting Practice","Improper Manual Handling","Bypassing Safety Devices","Horseplay / Unsafe Behaviour","Working Without Permit","Unauthorized Access","Distracted Working","Unsafe Driving"],"Unsafe Condition":["Inadequate Fall Protection","Defective Scaffolding / Ladders","Exposed / Defective Electrical System","Damaged Tools / Equipment","Unprotected Openings / Edges","Poor Housekeeping","Inadequate Lighting","Missing Safety Signage","Inadequate Barricades","Unsafe Excavation","Fire Hazard / Inadequate Fire Equipment","Chemical Leak / Inadequate Containment","Poor Ventilation","Slippery / Uneven Surface","Falling Object Hazard","Inadequate Emergency Equipment"],"HSE Observation":["Positive Safety Practice","Positive Health Practice","Positive Environmental Practice","HSE Improvement Opportunity"]}}},"labels":{"observed_at":"Date/time observed","hse_type":"Issue type","hse_category":"Category","person_involved":"Person / contractor involved","potential_consequences":"Potential consequence","risk_likelihood":"Risk likelihood","risk_severity":"Potential severity","risk_rating":"Risk rating","immediate_action":"Immediate action taken","corrective_action":"Corrective / preventive action","action_owner":"Action owner","due_date":"Due date","related_record":"Related incident","closure_note":"Verification / closure note"}},"hse_incident":{"required":["incident_at","incident_type","incident_category","immediate_response","incident_severity","investigation_required","hse_reviewer"],"rows":["corrective_actions"],"options":{"incident_type":["Near Miss","Injury / Illness","Property / Equipment Damage","Environmental Incident","Fire / Explosion","Vehicle / Traffic Incident","Other Event"],"injury_classification":["No Injury","First Aid","Medical Treatment","Restricted Work","Lost Time","Fatality"],"injury_nature":["Cut","Bruise","Fracture","Burn","Sprain","Respiratory","Eye","Other"],"body_part":["Head","Eye","Face","Hand","Arm","Back","Leg","Foot","Multiple","Other"],"environmental_impact":["None","Soil","Surface Water","Groundwater","Air","Waste","Wildlife","Vegetation","Other"],"property_damage":["None","Minor","Major","Total Loss","Under Assessment"],"authorities_notified":["Not Required","Pending","Notified"],"investigation_required":["Yes","No","To Be Determined"]},"dependent":{"incident_category":{"parent":"incident_type","groups":{"Near Miss":["Falling / Dropped Object Near Miss","Slip / Trip / Fall Near Miss","Vehicle / Equipment Near Collision","Electrical Near Miss","Lifting Operation Near Miss","Work-at-Height Near Miss","Excavation / Trenching Near Miss","Fire / Explosion Near Miss","Chemical Release Near Miss","Structural / Temporary Works Near Miss"],"Injury / Illness":["First Aid Case","Medical Treatment Case","Lost Time Injury (LTI)","Restricted Work Case","Occupational Illness","Fatality"],"Property / Equipment Damage":["Building / Structure Damage","Plant / Machinery Damage","Vehicle Accident / Damage","Material / Asset Damage"],"Environmental Incident":["Oil / Fuel Spill","Chemical Spill / Release","Waste Mismanagement Event","Wastewater / Sewage Release","Air Emission / Dust Event","Water / Soil Contamination","Wildlife / Vegetation Impact"],"Fire / Explosion":["Fire","Explosion","Smoke / Overheating Event"],"Vehicle / Traffic Incident":["Vehicle Collision","Vehicle Rollover","Pedestrian / Vehicle Contact","Reversing Incident","Load Shift / Falling Load"],"Other Event":["Security-Related Event","Public / Third-Party Incident","Other HSE Incident"]}}},"labels":{"incident_at":"Incident date/time","incident_type":"Incident type","incident_category":"Incident category","people_involved":"People involved / affected","injury_classification":"Injury classification","injury_nature":"Nature of injury / illness","body_part":"Body part affected","environmental_impact":"Environmental impact","property_damage":"Property / equipment damage","property_damage_detail":"Affected asset and estimated impact","immediate_response":"Immediate response","authorities_notified":"Authorities / client notified","notification_log":"Notification log","witnesses":"Witnesses","incident_severity":"Potential / actual severity","investigation_required":"Investigation required","investigation_findings":"Investigation findings / root cause","corrective_actions":"Corrective / preventive actions","related_observation":"Related HSE observation","hse_reviewer":"HSE reviewer","closure_note":"Closure note"}},"delivery":{"required":["delivery_at","supplier","purchase_order","material_group","material_specification","ordered_quantity","delivered_quantity","unit","delivery_status","arrival_condition","inspection_result","received_by"],"rows":[],"options":{"arrival_condition":["Good","Damaged","Wet","Contaminated","Incorrect","Mixed","Other"],"inspection_result":["Accepted","Accepted with Comments","Quarantined","Rejected","Pending Inspection"]},"dependent":{"material_group":{"parent":null,"groups":{"all":["Cement & Binders","Aggregates & Fill","Concrete & Precast","Reinforcement & Structural Steel","Masonry Materials","Timber & Formwork","Roofing & Waterproofing","Electrical Materials","Plumbing & Mechanical Materials","Finishes & Coatings","Hardware & Consumables","Fuel & Lubricants","Other Material"]}},"delivery_status":{"parent":null,"groups":{"all":["Scheduled","Arrived On Time","Delayed","Partial Delivery","Cancelled"]}},"discrepancy_type":{"parent":null,"groups":{"all":["Quantity Shortage","Excess Quantity","Wrong Specification","Damaged in Transit","Missing Documentation","Expired / Shelf-Life Concern","Packaging / Labelling Issue"]}}},"labels":{"delivery_at":"Delivery date/time","supplier":"Supplier","purchase_order":"Purchase order / requisition","delivery_note_number":"Delivery note number","material_group":"Material group","material_specification":"Material description / specification","ordered_quantity":"Ordered quantity","delivered_quantity":"Delivered quantity","unit":"Unit","delivery_status":"Delivery status","revised_delivery_date":"Revised delivery date","arrival_condition":"Condition on arrival","inspection_result":"Inspection result","storage_location":"Storage location","discrepancy_type":"Discrepancy","discrepancy_remarks":"Discrepancy / remarks","received_by":"Received by"}},"technical_instruction":{"required":["instruction_date","instruction_type","discipline","instruction_category","issued_to","action_owner"],"rows":[],"options":{"instruction_type":["Technical Clarification","Design / Drawing Clarification","Site Instruction","Corrective Technical Instruction","Construction Method / Sequence Instruction","Coordination / Interface Instruction","Inspection / Testing Instruction","Hold / Release Instruction","Technical Information / Document Request","Other"],"discipline":["Preliminaries & Site Establishment","Surveying & Setting Out","Earthworks & Ground Improvement","Foundations & Substructure","Concrete & Reinforced Concrete","Structural Steel & Metal Works","Masonry & Wall Construction","Architectural & Interior Finishes","Waterproofing & Roofing","Mechanical & HVAC Services","Plumbing, Sanitary & Drainage Services","Electrical & ELV Services","Fire Protection & Life Safety","External Civil Works & Infrastructure","Utilities & External Services","Landscaping & External Works","Testing, Commissioning & Handover"],"reason":["Design clarification","Site condition","Coordination","Specification conflict","Client request","Other"]},"dependent":{"instruction_category":{"parent":"discipline","groups":{"Preliminaries & Site Establishment":["Site access, hoarding & fencing","Temporary facilities & utilities","Site logistics, storage & laydown","Temporary works & protection","Mobilization / demobilization","Other – specify"],"Surveying & Setting Out":["Control points & benchmarks","Setting out / gridlines / coordinates","Levels, elevations & gradients","Survey tolerances & dimensional checks","As-built survey / record information","Other – specify"],"Earthworks & Ground Improvement":["Clearing, grubbing & stripping","Excavation, trenching & dewatering","Fill material & backfilling","Compaction & field density","Ground stabilization / improvement","Slope, embankment & formation level","Other – specify"],"Foundations & Substructure":["Foundation layout & dimensions","Piles, pile caps & pile testing","Footings, rafts & ground beams","Substructure concrete & reinforcement","Waterproofing / damp-proofing below grade","Backfill around foundations","Other – specify"],"Concrete & Reinforced Concrete":["Formwork & falsework","Reinforcement / rebar fixing","Concrete mix, grade & supply","Concrete placement, vibration & finishing","Curing, joints & surface treatment","Concrete testing / sampling","Embedded items, sleeves & cast-ins","Repair of defective concrete","Other – specify"],"Structural Steel & Metal Works":["Steel fabrication & material grade","Erection, alignment & tolerances","Bolted connections","Welds & welding procedures","Base plates, anchors & grouting","Protective coating / fireproofing","Inspection / testing of steelwork","Other – specify"],"Masonry & Wall Construction":["Block / brick type and specification","Wall layout, thickness & openings","Mortar, bonding & reinforcement","Lintels, ties & movement joints","Plumbness, line & level","Other – specify"],"Architectural & Interior Finishes":["Plastering, rendering & screed","Flooring, tiling & skirting","Ceilings & partitions","Doors, windows & glazing","Painting, coating & finishes","Joinery, fixtures & fittings","Other – specify"],"Waterproofing & Roofing":["Roof structure, sheets & coverings","Waterproofing membrane / application","Flashings, gutters & downpipes","Roof drainage & falls","Wet-area waterproofing","Waterproofing tests / leak investigation","Other – specify"],"Mechanical & HVAC Services":["HVAC equipment & capacity","Ductwork, insulation & supports","Refrigerant / chilled-water piping","Ventilation & air distribution","Equipment installation & alignment","Testing, balancing & commissioning","Other – specify"],"Plumbing, Sanitary & Drainage Services":["Water supply piping & fittings","Sanitary fixtures & connections","Soil, waste & vent piping","Stormwater / building drainage","Pumps, tanks & valves","Pressure, leakage & flow testing","Other – specify"],"Electrical & ELV Services":["Power distribution & switchgear","Cables, conduits & containment","Lighting & emergency lighting","Earthing & lightning protection","Data, communications & ELV systems","Testing, inspection & energization","Other – specify"],"Fire Protection & Life Safety":["Fire alarm & detection","Sprinkler / suppression systems","Fire pumps, tanks & hydrants","Fire stopping & compartmentation","Emergency systems & interfaces","Testing, cause-and-effect & commissioning","Other – specify"],"External Civil Works & Infrastructure":["Roads, pavements & hardstands","Kerbs, walkways & paving","Stormwater channels, culverts & drains","Retaining structures","Fencing, gates & barriers","Road marking & signage","Other – specify"],"Utilities & External Services":["Water supply / distribution","Sewerage / wastewater","Electrical utility connection","Telecommunications / data utility","Gas / fuel services where applicable","Utility crossings, protection & diversions","Other – specify"],"Landscaping & External Works":["Topsoil, grading & planting areas","Trees, shrubs & planting","Irrigation systems","Landscape edging & finishes","Erosion control & reinstatement","Other – specify"],"Testing, Commissioning & Handover":["Inspection & test plans / hold points","Pre-commissioning checks","Functional / performance testing","Integrated systems testing","Defect rectification / retesting","O&M manuals, training & handover records","Other – specify"]}}},"labels":{"instruction_date":"Instruction date","instruction_type":"Instruction type","discipline":"Discipline","instruction_category":"Category / subject","drawing_reference":"Drawing / document reference","reason":"Reason / background","reason_detail":"Supporting explanation","issued_to":"Issued to","action_owner":"Action owner","response_required_by":"Response required by","related_record":"Related record","closed_verified_by":"Closed / verified by"}},"change_order":{"required":["request_date","change_type","change_category","change_reason","originator","cost_currency","cost_impact","time_impact","time_impact_unit","approval_status","instruction_to_proceed"],"rows":[],"options":{"change_type":["Scope Change","Design Change","Quantity Variation","Material / Equipment Change","Construction Method Change","Site Condition Change","Schedule / Time Change","Regulatory / Compliance Change","Coordination / Interface Change","Temporary Facilities / Site Infrastructure"],"change_reason":["Client Request","Consultant Instruction","Design Development","Design Error / Omission","Unforeseen Site Condition","Regulatory Requirement","Material Unavailability","Quality Improvement","Value Engineering","HSE Requirement","Contractor Proposal","Coordination Requirement","Other"],"cost_currency":["SRD","USD","EUR"],"time_impact_unit":["Hours","Calendar Days","Working Days"],"approval_status":["Draft","Submitted","Under Technical Review","Under Commercial Review","Pending Client Approval","Approved","Rejected","Withdrawn","On Hold","Implemented","Closed"],"instruction_to_proceed":["Not Issued","Issued","Not Required"]},"dependent":{"change_category":{"parent":"change_type","groups":{"Scope Change":["Addition of Work","Omission of Work","Expansion of Scope","Reduction of Scope","Additional Deliverables"],"Design Change":["Architectural Modification","Structural Modification","MEP Design Modification","Drawing Revision","Design Correction"],"Quantity Variation":["Increase in Quantity","Decrease in Quantity","New BOQ Item","Removal of BOQ Item"],"Material / Equipment Change":["Material Substitution","Equipment Substitution","Material Specification Change","Alternative Product"],"Construction Method Change":["Change of Construction Method","Change of Installation Method","Change of Execution Sequence","Temporary Works Modification"],"Site Condition Change":["Unforeseen Ground Condition","Underground Utilities","Existing Structure Condition","Access Restriction","Environmental Site Condition"],"Schedule / Time Change":["Acceleration of Works","Work Resequencing","Change in Working Hours","Milestone / Completion Date Adjustment"],"Regulatory / Compliance Change":["Regulatory Requirement","Authority Requirement","Building Code Compliance","HSE Compliance Requirement"],"Coordination / Interface Change":["Design Coordination","Utility Coordination","Contractor Interface","Clash Resolution"],"Temporary Facilities / Site Infrastructure":["Site Office Modification","Storage Facility Modification","Temporary Utility Installation","Access Road Modification"]}}},"labels":{"request_date":"Request date","change_type":"Change type","change_category":"Change category","change_reason":"Reason for change","originator":"Originator / requester","drawing_reference":"Drawing / specification reference","added_quantity":"Added quantity","omitted_quantity":"Omitted quantity","quantity_unit":"Unit","cost_currency":"Currency","cost_impact":"Cost impact","time_impact":"Time impact","time_impact_unit":"Time unit","assessment":"Cost / schedule assessment","approval_status":"Approval status","approved_amount":"Approved amount","approved_days":"Approved days","instruction_to_proceed":"Instruction to proceed","related_record":"Related records"}},"delay_report":{"required":["delay_start_at","delay_cause_type","delay_cause_category","detailed_cause","delay_duration","duration_unit","duration_basis","critical_path","recovery_action","action_owner"],"rows":[],"options":{"delay_cause_type":["Labour","Materials & Procurement","Equipment","Design & Approvals","Site & External Conditions","Planning & Coordination","Quality & Rework","Other"],"responsible_party":["Client","Consultant","Main Contractor","Subcontractor","Supplier","Utility Provider","Authority","Weather","Shared","Undetermined"],"duration_unit":["Hours","Calendar Days","Working Days"],"duration_basis":["Actual","Estimated"],"critical_path":["Yes","No","Under Assessment"]},"dependent":{"delay_cause_category":{"parent":"delay_cause_type","groups":{"Labour":["Insufficient Manpower","Absenteeism","Low Productivity","Labour Dispute / Industrial Action"],"Materials & Procurement":["Late Material Delivery","Material Shortage","Incorrect / Rejected Material","Procurement / Supplier Delay"],"Equipment":["Equipment Breakdown","Equipment Unavailable","Equipment Performance"],"Design & Approvals":["Late Drawings / Information","Design Change / Revision","Pending RFI / Technical Clarification","Pending Client / Consultant Approval","Permit / Authority Approval"],"Site & External Conditions":["Adverse Weather","Access Restriction","Ground / Site Conditions","Utility Interference","Third-Party Interference"],"Planning & Coordination":["Poor Work Sequencing","Preceding Activity Incomplete","Subcontractor Delay","Coordination / Interface Issue","Insufficient Planning"],"Quality & Rework":["Failed Inspection / Test","Rework Required","NCR / Quality Hold"],"Other":["Other Delay Cause"]}}},"labels":{"delay_start_at":"Delay start date/time","affected_activity":"Affected activity","affected_activity_text":"Affected activity (not in the list)","delay_cause_type":"Delay cause type","delay_cause_category":"Delay cause category","detailed_cause":"Detailed cause","responsible_party":"Responsible party","delay_duration":"Delay duration","duration_unit":"Duration unit","duration_basis":"Duration is","critical_path":"Critical path impact","milestone_impact":"Schedule / milestone impact","recovery_action":"Mitigation / recovery action","action_owner":"Action owner","target_recovery_date":"Target recovery date","closure_note":"Closure note and reviewer"}},"lessons_learned":{"required":["recorded_on","project_phase","lesson_category","situation","what_happened","impact_types","impact_detail","lesson_learned","recommendation","applicability","review_status"],"rows":[],"options":{"project_phase":["Initiation & Feasibility","Planning & Design","Procurement & Contracting","Mobilization & Site Establishment","Construction & Execution","Testing & Commissioning","Handover & Close-out","Post-Project Review"],"impact_types":["Cost","Schedule","Quality","Scope","Resources","Client","Other"],"applicability":["Current Project","Future Projects","Specific Discipline","Organization-wide"],"discipline":["Preliminaries & Site Establishment","Surveying & Setting Out","Earthworks & Ground Improvement","Foundations & Substructure","Concrete & Reinforced Concrete","Structural Steel & Metal Works","Masonry & Wall Construction","Architectural & Interior Finishes","Waterproofing & Roofing","Mechanical & HVAC Services","Plumbing, Sanitary & Drainage Services","Electrical & ELV Services","Fire Protection & Life Safety","External Civil Works & Infrastructure","Utilities & External Services","Landscaping & External Works","Testing, Commissioning & Handover"],"review_status":["Draft","Submitted","Reviewed","Approved for Sharing","Archived"]},"dependent":{"lesson_category":{"parent":"project_phase","groups":{"Initiation & Feasibility":["Project Objectives & Requirements","Feasibility & Options Assessment","Site Selection & Due Diligence","Stakeholder Identification & Engagement","Risk Identification at Project Start"],"Planning & Design":["Scope Definition & Work Breakdown","Design Development & Completeness","Constructability & Buildability","Design Coordination & Clash Resolution","Permits, Codes & Authority Approvals","Cost Estimation & Budget Planning","Schedule Development & Sequencing","Risk Planning & Mitigation"],"Procurement & Contracting":["Tendering & Bid Evaluation","Contract Scope & Conditions","Supplier / Subcontractor Selection","Material & Equipment Submittals","Lead Times & Procurement Planning","Purchase Orders & Commercial Administration"],"Mobilization & Site Establishment":["Site Access & Possession","Temporary Facilities & Utilities","Site Layout & Logistics Setup","Workforce Mobilization & Induction","Plant, Equipment & Tools Readiness","Baseline Programme & Readiness"],"Construction & Execution":["Workmanship & Construction Methods","Productivity & Resource Utilization","Materials Delivery, Storage & Handling","Workfront & Contractor Coordination","Quality Control & Inspection","Health & Safety Management","Environmental Management","Site Supervision & Communication","Changes, Variations & Claims","Progress Monitoring & Recovery","Unexpected Site Conditions","Documentation & Record Keeping"],"Testing & Commissioning":["Testing & Inspection Planning","System Testing & Performance","Defect Identification & Rectification","Commissioning Coordination","Operational Readiness & Training"],"Handover & Close-out":["Handover Planning & Acceptance","As-Built Drawings & Technical Records","Certificates, Warranties & Compliance Records","Outstanding Works & Punch List Closure","Final Accounts & Contract Close-out","Client / End-User Handover"],"Post-Project Review":["Final Project Performance Review","Benefits & Outcomes Realization","Lessons Capture & Knowledge Transfer","Asset Performance Feedback"]}}},"labels":{"recorded_on":"Date recorded","project_phase":"Project phase","lesson_category":"Lesson category","situation":"Situation / context","what_happened":"What happened?","impact_types":"Impact / consequence","impact_detail":"Actual consequence","root_cause":"Root cause / contributing factors","lesson_learned":"Lesson learned","recommendation":"Recommendation / preventive action","applicability":"Applicability","discipline":"Discipline","action_owner":"Action owner","review_status":"Review status"}},"agreement":{"required":["agreement_at","agreement_type","agreement_category","agreed_by","action_required"],"rows":[],"options":{"meeting_source":["Site Meeting","Coordination Meeting","Technical Meeting","Client Meeting","Email","Site Discussion","Other"],"agreement_type":["Action / Task Commitment","Technical / Engineering Decision","Design / Drawing Decision","Scope / Work Execution Agreement","Schedule / Milestone Agreement","Coordination / Interface Agreement","Quality / Inspection Agreement","HSE / Environmental Agreement","Materials / Procurement Agreement","Site Access / Logistics Agreement","Resources / Responsibilities Agreement","Commercial / Contractual Agreement","Administrative / Documentation Agreement"],"action_required":["Yes","No"],"discipline":["Preliminaries & Site Establishment","Surveying & Setting Out","Earthworks & Ground Improvement","Foundations & Substructure","Concrete & Reinforced Concrete","Structural Steel & Metal Works","Masonry & Wall Construction","Architectural & Interior Finishes","Waterproofing & Roofing","Mechanical & HVAC Services","Plumbing, Sanitary & Drainage Services","Electrical & ELV Services","Fire Protection & Life Safety","External Civil Works & Infrastructure","Utilities & External Services","Landscaping & External Works","Testing, Commissioning & Handover"]},"dependent":{"agreement_category":{"parent":"agreement_type","groups":{"Action / Task Commitment":["Submission / Information Required","Investigation / Assessment","Corrective / Follow-up Action","Completion of Outstanding Work"],"Technical / Engineering Decision":["Technical Solution Agreed","Construction / Installation Method","Technical Clarification / Interpretation","Temporary Works / Engineering Control"],"Design / Drawing Decision":["Design Detail Agreed","Drawing Revision / Update","Design Coordination Resolution","Design Submission / Approval"],"Scope / Work Execution Agreement":["Inclusion of Work","Exclusion of Work","Work Boundary / Interface","Execution Responsibility","Sequence / Phasing of Work"],"Schedule / Milestone Agreement":["Start / Restart Date","Completion / Handover Date","Milestone / Target Date","Recovery / Acceleration Plan","Work Sequence / Lookahead Plan"],"Coordination / Interface Agreement":["Multi-Discipline Coordination","Contractor / Subcontractor Interface","Utility / Third-Party Coordination","Access / Workfront Coordination"],"Quality / Inspection Agreement":["Inspection / Test Arrangement","Acceptance Criteria","Mock-up / Sample Approval","Rework / Repair Approach","Quality Documentation"],"HSE / Environmental Agreement":["Safety Control / Precaution","Permit / Safe Work Arrangement","Environmental Protection Measure","Incident / Hazard Follow-up"],"Materials / Procurement Agreement":["Material / Product Selection","Material Substitution","Sample / Technical Submittal","Procurement / Purchase Action","Delivery / Supply Date"],"Site Access / Logistics Agreement":["Site / Area Access","Delivery / Lifting Arrangement","Storage / Laydown Arrangement","Traffic / Route Arrangement","Temporary Facilities / Utilities"],"Resources / Responsibilities Agreement":["Responsible Party Assigned","Action Owner Assigned","Labour / Crew Allocation","Plant / Equipment Allocation","Shared Responsibility"],"Commercial / Contractual Agreement":["Rate / Price Agreement","Payment / Valuation Matter","Variation / Change Evaluation","Contractual Clarification","Claim / Entitlement Review"],"Administrative / Documentation Agreement":["Document Submission / Revision","Record / Register Update","Meeting / Reporting Requirement","Approval / Sign-off Process"]}}},"labels":{"agreement_at":"Meeting / agreement date","meeting_source":"Meeting / source","meeting_reference":"Meeting number / reference","agreement_type":"Agreement type","agreement_category":"Agreement category","agreed_by":"Agreed by","action_required":"Action required","action_owner":"Action owner","due_date":"Due date","discipline":"Related discipline","related_location":"Related location","related_record":"Related record","closure_note":"Confirmation / closure note"}},"works_ongoing":{"required":["report_date","discipline","activity","exact_location","work_item","progress_status","crew"],"rows":[],"options":{"discipline":["Preliminaries & Site Establishment","Surveying & Setting Out","Earthworks & Ground Improvement","Foundations & Substructure","Concrete & Reinforced Concrete","Structural Steel & Metal Works","Masonry & Wall Construction","Architectural & Interior Finishes","Waterproofing & Roofing","Mechanical & HVAC Services","Plumbing, Sanitary & Drainage Services","Electrical & ELV Services","Fire Protection & Life Safety","External Civil Works & Infrastructure","Utilities & External Services","Landscaping & External Works","Testing, Commissioning & Handover"],"secondary_discipline":["Preliminaries & Site Establishment","Surveying & Setting Out","Earthworks & Ground Improvement","Foundations & Substructure","Concrete & Reinforced Concrete","Structural Steel & Metal Works","Masonry & Wall Construction","Architectural & Interior Finishes","Waterproofing & Roofing","Mechanical & HVAC Services","Plumbing, Sanitary & Drainage Services","Electrical & ELV Services","Fire Protection & Life Safety","External Civil Works & Infrastructure","Utilities & External Services","Landscaping & External Works","Testing, Commissioning & Handover"],"progress_status":["Not Started","In Progress","On Hold","Completed"],"element_type":["Slab","Beam","Column","Footing","Wall","Other"],"blocker":["None","Materials","Equipment","Labour","Design","Access","Weather","Approval","Other"]},"dependent":{},"labels":{"report_date":"Report date","shift":"Shift","discipline":"Work discipline","secondary_discipline":"Secondary discipline","activity":"Activity","exact_location":"Exact location / grid / level","work_item":"What exactly is being worked on?","quantity_na":"Quantity not measurable (N/A)","quantity":"Quantity completed","quantity_unit":"Unit","progress_status":"Progress status","progress_percent":"Progress percentage","crew":"Crew / contractor","start_time":"Start time","finish_time":"Finish time","crosses_midnight":"Work crosses midnight","element_type":"Element","element_id":"Element ID","concrete_grade":"Concrete grade / mix","concrete_volume":"Volume (m³)","delivery_tickets":"Delivery ticket / batch references","slump_cube_refs":"Slump and cube sample references","activity_details":"Details for this activity","inspection_reference":"Inspection / test reference","blocker":"Blocker / issue","blocker_record":"Linked issue or delay report","remarks":"Remarks"}},"works_completed":{"required":["completion_date","discipline","activity","exact_location","completed_items","inspection_status","crew"],"rows":[],"options":{"discipline":["Preliminaries & Site Establishment","Surveying & Setting Out","Earthworks & Ground Improvement","Foundations & Substructure","Concrete & Reinforced Concrete","Structural Steel & Metal Works","Masonry & Wall Construction","Architectural & Interior Finishes","Waterproofing & Roofing","Mechanical & HVAC Services","Plumbing, Sanitary & Drainage Services","Electrical & ELV Services","Fire Protection & Life Safety","External Civil Works & Infrastructure","Utilities & External Services","Landscaping & External Works","Testing, Commissioning & Handover"],"secondary_discipline":["Preliminaries & Site Establishment","Surveying & Setting Out","Earthworks & Ground Improvement","Foundations & Substructure","Concrete & Reinforced Concrete","Structural Steel & Metal Works","Masonry & Wall Construction","Architectural & Interior Finishes","Waterproofing & Roofing","Mechanical & HVAC Services","Plumbing, Sanitary & Drainage Services","Electrical & ELV Services","Fire Protection & Life Safety","External Civil Works & Infrastructure","Utilities & External Services","Landscaping & External Works","Testing, Commissioning & Handover"],"inspection_status":["Completed - Awaiting Inspection","Inspected - Accepted","Inspected - Rejected","Not Applicable"]},"dependent":{},"labels":{"completion_date":"Completion date","discipline":"Work discipline","secondary_discipline":"Secondary discipline","activity":"Activity","exact_location":"Exact location / grid / level","completed_items":"What was completed?","quantity_na":"Quantity not measurable (N/A)","quantity":"Quantity completed","quantity_unit":"Unit","inspection_status":"Completion / inspection status","inspection_reference":"Inspection reference","ncr_reference":"Linked NCR / issue","crew":"Contractor / crew","outstanding":"Outstanding work / defects","remarks":"Remarks"}}}'::jsonb;
$rules$;

-- The workbook form a stored record belongs to.
create or replace function app_private.spec_form_of(p_table text, p_row jsonb)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case p_table
    when 'findings' then case when p_row ->> 'finding_type' = 'ncr' then 'ncr' else 'issue' end
    when 'hse_events' then case when p_row ->> 'event_type' in ('incident', 'near_miss') then 'hse_incident' else 'hse' end
    when 'project_register_entries' then p_row ->> 'register_type'
  end;
$$;

create or replace function app_private.spec_values(p_value jsonb)
returns text[]
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(array_agg(btrim(item)) filter (where btrim(item) <> ''), '{}')
  from (
    select value #>> '{}' as item from jsonb_array_elements(case when jsonb_typeof(p_value) = 'array' then p_value else '[]'::jsonb end)
    where jsonb_typeof(value) in ('string', 'number')
    union all
    select p_value #>> '{}' where jsonb_typeof(p_value) in ('string', 'number')
  ) items;
$$;

-- The rule breaches of one spec object, as readable sentences (empty when it complies).
create or replace function app_private.spec_violations(p_form text, p_spec jsonb, p_old jsonb, p_check_required boolean)
returns text[]
language plpgsql
stable
set search_path = pg_catalog, app_private
as $$
declare
  v_rules jsonb := app_private.spec_form_rules() -> p_form;
  v_out text[] := '{}';
  v_key text;
  v_allowed jsonb;
  v_value text;
  v_group text;
  v_label text;
begin
  if v_rules is null or jsonb_typeof(p_spec) <> 'object' then return v_out; end if;
  if p_check_required then
    for v_key in select jsonb_array_elements_text(v_rules -> 'required') loop
      if cardinality(app_private.spec_values(p_spec -> v_key)) = 0 then
        v_out := v_out || ('Required: ' || coalesce(v_rules #>> array['labels', v_key], v_key));
      end if;
    end loop;
    for v_key in select jsonb_array_elements_text(v_rules -> 'rows') loop
      if jsonb_typeof(p_spec -> v_key) is distinct from 'array' or jsonb_array_length(p_spec -> v_key) = 0 then
        v_out := v_out || ('Required: ' || coalesce(v_rules #>> array['labels', v_key], v_key));
      end if;
    end loop;
  end if;
  for v_key, v_allowed in select key, value from jsonb_each(coalesce(v_rules -> 'options', '{}'::jsonb)) loop
    continue when not p_spec ? v_key;
    continue when p_old is not null and (p_spec -> v_key) is not distinct from (p_old -> v_key);
    foreach v_value in array app_private.spec_values(p_spec -> v_key) loop
      if not v_allowed ? v_value then
        v_out := v_out || (coalesce(v_rules #>> array['labels', v_key], v_key) || ': "' || v_value || '" is not one of the list''s values');
      end if;
    end loop;
  end loop;
  for v_key, v_allowed in select key, value from jsonb_each(coalesce(v_rules -> 'dependent', '{}'::jsonb)) loop
    continue when not p_spec ? v_key;
    continue when p_old is not null and (p_spec -> v_key) is not distinct from (p_old -> v_key)
      and (v_allowed ->> 'parent' is null or (p_spec -> (v_allowed ->> 'parent')) is not distinct from (p_old -> (v_allowed ->> 'parent')));
    v_group := case when v_allowed ->> 'parent' is null then 'all' else p_spec ->> (v_allowed ->> 'parent') end;
    continue when v_group is null or not (v_allowed -> 'groups') ? v_group;
    v_label := coalesce(v_rules #>> array['labels', v_key], v_key);
    foreach v_value in array app_private.spec_values(p_spec -> v_key) loop
      if not (v_allowed #> array['groups', v_group]) ? v_value then
        v_out := v_out || (v_label || ': "' || v_value || '" does not belong to "' || v_group || '"');
      end if;
    end loop;
  end loop;
  return v_out;
end;
$$;

create or replace function app_private.validate_record_spec()
returns trigger
language plpgsql
set search_path = pg_catalog, public, app_private
as $$
declare
  v_path text[] := app_private.spec_path(tg_table_name);
  v_row jsonb := to_jsonb(new);
  v_spec jsonb := v_row #> v_path;
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) #> v_path end;
  v_violations text[];
begin
  -- Server-side code without a signed-in user (migrations, the service role, the account-free
  -- share link) is trusted, as in guard_record_spec.
  if (select auth.uid()) is null or jsonb_typeof(v_spec) is distinct from 'object' or v_spec = '{}'::jsonb then
    return new;
  end if;
  if tg_op = 'UPDATE' and v_spec is not distinct from v_old then return new; end if;
  v_violations := app_private.spec_violations(app_private.spec_form_of(tg_table_name, v_row), v_spec, v_old, v_spec ? '_rules');
  if cardinality(v_violations) > 0 then
    raise exception 'The form cannot be saved: %', array_to_string(v_violations, '; ') using errcode = '22023';
  end if;
  return new;
end;
$$;

-- "zz" so the check sees the spec after the guard (sensitive data moved, decisions stamped).
drop trigger if exists findings_zz_spec_validate on public.findings;
create trigger findings_zz_spec_validate before insert or update of issue_management on public.findings
  for each row execute function app_private.validate_record_spec();
drop trigger if exists hse_events_zz_spec_validate on public.hse_events;
create trigger hse_events_zz_spec_validate before insert or update of spec on public.hse_events
  for each row execute function app_private.validate_record_spec();
drop trigger if exists project_register_entries_zz_spec_validate on public.project_register_entries;
create trigger project_register_entries_zz_spec_validate before insert or update of details on public.project_register_entries
  for each row execute function app_private.validate_record_spec();

create or replace function public.record_signoff_action(
  p_project_id uuid,
  p_record_kind text,
  p_record_id uuid,
  p_workflow_profile text,
  p_stage_number integer,
  p_action text,
  p_actor_role text,
  p_attestation_method text default 'account',
  p_actor_name text default null,
  p_actor_organization text default null,
  p_signature_image text default null,
  p_evidence_file_id uuid default null,
  p_comments text default null,
  p_return_reason text default null,
  p_next_actor text default null,
  p_next_actor_user_id uuid default null,
  p_due_at timestamptz default null
)
returns public.record_signoff_events
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_actor uuid := (select auth.uid());
  v_project public.projects;
  v_record jsonb;
  v_last public.record_signoff_events;
  v_last_submit public.record_signoff_events;
  v_round integer := 1;
  v_status text;
  v_name text;
  v_event public.record_signoff_events;
  v_authority boolean;
  v_config jsonb;
  v_stage_config jsonb;
  v_approvers jsonb;
  v_required integer;
  v_count integer;
  v_due timestamptz := p_due_at;
  v_limit numeric;
  v_amount numeric;
  v_delegate boolean := false;
  v_number text;
  v_creator uuid;
  v_recipient uuid;
  v_member_roles text;
  v_member_organization text;
  v_stage integer := greatest(1, least(coalesce(p_stage_number, 1), 9));
  v_expected_profile text;
  v_stage_actions jsonb;
  v_violations text[];
begin
  if v_actor is null or not app_private.has_project_permission(p_project_id, 'records.read') then
    raise exception 'Not a member of this project' using errcode = '42501';
  end if;
  select project.* into v_project from public.projects project where project.id = p_project_id;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;

  -- The record must exist in this project; its current content is frozen with a submission.
  v_record := case p_record_kind
    when 'finding' then (select to_jsonb(item) from public.findings item where item.id = p_record_id and item.project_id = p_project_id)
    when 'hse_event' then (select to_jsonb(item) from public.hse_events item where item.id = p_record_id and item.project_id = p_project_id)
    when 'register_entry' then (select to_jsonb(item) from public.project_register_entries item where item.id = p_record_id and item.project_id = p_project_id)
    when 'inspection' then (select to_jsonb(item) from public.inspections item where item.id = p_record_id and item.project_id = p_project_id)
    when 'day_report' then (select to_jsonb(item) from public.day_reports item where item.id = p_record_id and item.project_id = p_project_id)
  end;
  if v_record is null then raise exception 'Record not found in project' using errcode = 'P0002'; end if;
  v_number := coalesce(v_record ->> 'finding_number', v_record ->> 'event_number', v_record ->> 'entry_number', v_record ->> 'inspection_number', v_record ->> 'report_number', 'record');
  v_creator := nullif(v_record ->> 'created_by', '')::uuid;
  -- Confidential HSE details stay with HSE: the frozen copy of such a record keeps no narrative,
  -- and no HSE copy ever holds the people involved, witnesses or injuries.
  if p_record_kind = 'hse_event' then
    if coalesce((v_record ->> 'confidential')::boolean, false) then
      v_record := v_record - 'description' - 'root_cause' - 'notes' - 'immediate_measure';
    end if;
    v_record := jsonb_set(v_record, '{spec}', coalesce((
      select jsonb_object_agg(item.key, item.value) from jsonb_each(coalesce(v_record -> 'spec', '{}'::jsonb)) item
      where not app_private.spec_sensitive_key(item.key)), '{}'::jsonb));
  end if;

  -- Approving, accepting, rejecting, verifying, closing and reopening are role-restricted.
  v_authority := app_private.has_project_permission(p_project_id, 'findings.verify')
    or app_private.has_project_permission(p_project_id, 'reports.review')
    or (p_record_kind = 'hse_event' and app_private.has_project_permission(p_project_id, 'hse.manage'))
    or (p_record_kind = 'inspection' and app_private.has_project_permission(p_project_id, 'inspections.manage'));
  if p_action in ('approve', 'accept', 'reject', 'verify', 'close', 'reopen') and not v_authority then
    raise exception 'Only an authorised reviewer can % this record', p_action using errcode = '42501';
  end if;
  if p_action not in ('approve', 'accept', 'reject', 'verify', 'close', 'reopen', 'witness', 'acknowledge')
    and not app_private.has_project_permission(p_project_id, 'records.create') then
    raise exception 'Missing records.create permission' using errcode = '42501';
  end if;

  -- F16: the workflow profile is the record's own, and the stage offers the action (the approved
  -- profiles, app_private.signoff_profile_stages). Withdraw and reopen apply at any stage.
  v_expected_profile := case p_record_kind
    when 'finding' then case when v_record ->> 'finding_type' = 'ncr' then 'NCR-CORRECTIVE' else 'ISSUE-CLOSEOUT' end
    when 'hse_event' then case when v_record ->> 'event_type' in ('incident', 'near_miss') then 'HSE-INCIDENT' else 'HSE-OBSERVATION' end
    when 'inspection' then 'INSPECTION-WITNESS'
    when 'day_report' then 'WF-ATTENDANCE'
    when 'register_entry' then case v_record ->> 'register_type'
      when 'works_ongoing' then 'WO-DAILY' when 'works_completed' then 'WC-COMPLETION' when 'delay_report' then 'PDR-REVIEW'
      when 'delivery' then 'MAT-RECEIPT' when 'technical_instruction' then 'TECH-INSTRUCTION' when 'change_order' then 'CHANGE-APPROVAL'
      when 'agreement' then 'AGREEMENT-ACK' when 'lessons_learned' then 'LESSON-REVIEW' end
  end;
  if v_expected_profile is not null and p_workflow_profile is distinct from v_expected_profile then
    raise exception 'This record follows the % workflow', v_expected_profile using errcode = '22023';
  end if;
  v_stage_actions := app_private.signoff_profile_stages(p_workflow_profile);
  if v_stage_actions is not null and p_action not in ('withdraw', 'reopen')
      and not coalesce(v_stage_actions -> v_stage::text, '[]'::jsonb) ? p_action then
    raise exception 'Stage % of % does not offer %', v_stage, p_workflow_profile, p_action using errcode = '22023';
  end if;

  -- F03: a formal submission is complete. The workbook's always-required fields and its fixed lists
  -- are checked on the stored record, whatever path wrote it (form, offline replay, older client).
  if p_action in ('submit', 'resubmit') then
    v_violations := app_private.spec_violations(
      app_private.spec_form_of(case p_record_kind when 'finding' then 'findings' when 'hse_event' then 'hse_events'
        when 'register_entry' then 'project_register_entries' else p_record_kind end, v_record),
      coalesce(v_record #> case p_record_kind when 'finding' then array['issue_management', 'spec'] when 'register_entry' then array['details', 'spec'] else array['spec'] end, '{}'::jsonb),
      null, true);
    if cardinality(v_violations) > 0 then
      raise exception 'Complete the form before submitting: %', array_to_string(v_violations, '; ') using errcode = '22023';
    end if;
  end if;

  -- Mandatory comments for a return, a rejection, a withdrawal and a reopening.
  if p_action in ('return', 'reject', 'withdraw', 'reopen') and char_length(btrim(coalesce(p_comments, ''))) < 3 then
    raise exception 'A comment is required to % a record', p_action using errcode = '22023';
  end if;
  if p_action = 'return' and char_length(btrim(coalesce(p_next_actor, ''))) < 2 and p_next_actor_user_id is null then
    raise exception 'A return names who acts next' using errcode = '22023';
  end if;
  if p_attestation_method <> 'account' and char_length(btrim(coalesce(p_actor_name, ''))) < 2 then
    raise exception 'An external representative is recorded by name' using errcode = '22023';
  end if;
  -- A signed document is a file of this project.
  if p_attestation_method = 'signed_document' and (p_evidence_file_id is null or not exists (
    select 1 from public.files file where file.id = p_evidence_file_id and file.project_id = p_project_id and file.status <> 'deleted')) then
    raise exception 'A signed document is a file uploaded to this project' using errcode = '22023';
  end if;
  if p_evidence_file_id is not null and not exists (
    select 1 from public.files file where file.id = p_evidence_file_id and file.project_id = p_project_id) then
    raise exception 'Evidence file not found in project' using errcode = 'P0002';
  end if;
  -- The next responsible person is someone on this project.
  if p_next_actor_user_id is not null and not exists (
    select 1 from public.list_project_people(p_project_id) person where person.user_id = p_next_actor_user_id) then
    raise exception 'The next responsible person is not on this project' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_record_kind || ':' || p_record_id::text || ':signoff', 0));
  select event.* into v_last from public.record_signoff_events event
  where event.record_kind = p_record_kind and event.record_id = p_record_id
  order by event.sequence_number desc limit 1;

  if found then
    v_round := v_last.round_number + case when p_action = 'resubmit' then 1 else 0 end;
    if v_last.new_status in ('Closed', 'Withdrawn') and p_action <> 'reopen' then
      raise exception 'This record is %; reopen it first', lower(v_last.new_status) using errcode = '22023';
    end if;
    if p_action = 'submit' then
      raise exception 'This record was already submitted; resubmit it after a return' using errcode = '22023';
    end if;
  elsif p_action not in ('submit', 'acknowledge', 'witness') then
    raise exception 'The first sign-off action on a record is a submission' using errcode = '22023';
  end if;
  if p_action = 'resubmit' and (v_last.id is null or v_last.new_status not in ('Returned for Correction', 'Rejected', 'Reopened')) then
    raise exception 'Only a returned record is resubmitted' using errcode = '22023';
  end if;

  -- A user does not approve their own submission.
  if p_action in ('approve', 'accept', 'verify', 'close') and p_attestation_method = 'account' then
    select event.* into v_last_submit from public.record_signoff_events event
    where event.record_kind = p_record_kind and event.record_id = p_record_id
      and event.round_number = v_round and event.action in ('submit', 'resubmit', 'respond')
      and event.attestation_method = 'account'
    order by event.sequence_number desc limit 1;
    if found and v_last_submit.actor_user_id = v_actor and v_last_submit.action <> 'submit' then
      raise exception 'You cannot approve your own response' using errcode = '42501';
    end if;
    if found and v_last_submit.actor_user_id = v_actor and v_last_submit.action = 'submit'
      and p_workflow_profile in ('WO-DAILY', 'WC-COMPLETION', 'WF-ATTENDANCE', 'PDR-REVIEW', 'CHANGE-APPROVAL', 'LESSON-REVIEW') then
      raise exception 'You cannot approve your own submission' using errcode = '42501';
    end if;
  end if;

  -- The project's own settings for this workflow: approvers, delegation, limits, due days.
  v_config := app_private.spec_configuration(p_project_id) #> array['workflows', p_workflow_profile];
  v_stage_config := v_config #> array['stages', greatest(1, least(coalesce(p_stage_number, 1), 9))::text];
  if p_action in ('approve', 'accept', 'verify', 'close', 'reject') and p_attestation_method = 'account' then
    v_approvers := coalesce(v_stage_config -> 'approver_user_ids', '[]'::jsonb);
    if jsonb_array_length(v_approvers) > 0 and not v_approvers ? v_actor::text then
      select exists (
        select 1 from jsonb_array_elements(coalesce(v_config -> 'delegations', '[]'::jsonb)) delegation
        where delegation ->> 'to' = v_actor::text and v_approvers ? (delegation ->> 'from')
          and coalesce(nullif(delegation ->> 'until', '')::date, current_date) >= (now() at time zone 'America/Paramaribo')::date
      ) into v_delegate;
      if not v_delegate then
        raise exception 'Only the approvers this project named for this step can %', p_action using errcode = '42501';
      end if;
    end if;
    if p_workflow_profile = 'CHANGE-APPROVAL' and p_action = 'approve' then
      v_limit := nullif(v_config ->> 'approval_limit', '')::numeric;
      v_amount := greatest(
        coalesce(nullif(v_record #>> '{details,spec,approved_amount}', '')::numeric, 0),
        coalesce(nullif(v_record #>> '{details,spec,cost_impact}', '')::numeric, 0));
      if v_limit is not null and v_amount > v_limit and not coalesce(v_config -> 'above_limit_user_ids', '[]'::jsonb) ? v_actor::text then
        raise exception 'This change exceeds the approval limit of %; an approver above the limit decides', v_limit using errcode = '42501';
      end if;
    end if;
  end if;
  if v_due is null and nullif(v_stage_config ->> 'due_days', '') is not null and p_action not in ('close', 'withdraw') then
    v_due := now() + make_interval(days => (v_stage_config ->> 'due_days')::integer);
  end if;

  v_status := case p_action
    when 'submit' then 'Submitted'
    when 'acknowledge' then 'Acknowledged'
    when 'review' then 'Under Review'
    when 'approve' then 'Approved'
    when 'accept' then 'Accepted'
    when 'reject' then 'Rejected'
    when 'return' then 'Returned for Correction'
    when 'respond' then 'Responded'
    when 'resubmit' then 'Resubmitted'
    when 'verify' then 'Verified'
    when 'close' then 'Closed'
    when 'withdraw' then 'Withdrawn'
    when 'reopen' then 'Reopened'
    when 'witness' then coalesce(v_last.new_status, 'Witnessed')
  end;

  -- Parallel review: every designated approval before the record moves on.
  v_required := coalesce(nullif(v_stage_config ->> 'required_approvals', '')::integer, 1);
  if p_action in ('approve', 'accept', 'verify') and v_required > 1 then
    select count(distinct coalesce(event.actor_user_id::text || ':' || event.actor_name, '')) + 1 into v_count
    from public.record_signoff_events event
    where event.record_kind = p_record_kind and event.record_id = p_record_id and event.round_number = v_round
      and event.action = p_action and event.stage_number = greatest(1, least(coalesce(p_stage_number, 1), 9))
      and not (event.actor_user_id = v_actor and event.attestation_method = 'account' and p_attestation_method = 'account');
    if exists (
      select 1 from public.record_signoff_events event
      where event.record_kind = p_record_kind and event.record_id = p_record_id and event.round_number = v_round
        and event.action = p_action and event.actor_user_id = v_actor and event.attestation_method = 'account' and p_attestation_method = 'account'
    ) then
      raise exception 'You already recorded this approval in this round' using errcode = '22023';
    end if;
    if v_count < v_required then
      v_status := 'Partially Approved (' || v_count || '/' || v_required || ')';
    end if;
  end if;

  select nullif(btrim(profile.display_name), '') into v_name
  from public.profiles profile where profile.id = v_actor;
  -- F16: who signs with an account is described by the server: the project roles and the
  -- organisation of the membership. The role chosen in the screen is kept as the stage role.
  select string_agg(distinct role.name, ', ' order by role.name) into v_member_roles
  from public.project_memberships membership
  join public.project_member_roles member_role on member_role.membership_id = membership.id and member_role.project_id = membership.project_id
  join public.roles role on role.id = member_role.role_id
  where membership.project_id = p_project_id and membership.user_id = v_actor and membership.status = 'active';
  select coalesce(party.name, organization.name) into v_member_organization
  from public.projects project
  join public.organizations organization on organization.id = project.organization_id
  left join public.project_memberships membership on membership.project_id = project.id and membership.user_id = v_actor and membership.status = 'active'
  left join public.parties party on party.id = membership.portal_party_id
  where project.id = p_project_id
  limit 1;

  insert into public.record_signoff_events (
    organization_id, project_id, record_kind, record_id, workflow_profile, round_number,
    stage_number, action, actor_user_id, actor_name, actor_organization, actor_role, stage_role,
    attestation_method, signature_image, evidence_file_id, comments, return_reason,
    next_actor, next_actor_user_id, due_at, submitted_version, previous_status, new_status
  ) values (
    v_project.organization_id, p_project_id, p_record_kind, p_record_id, p_workflow_profile, v_round,
    v_stage, p_action, v_actor,
    case when p_attestation_method = 'account' then coalesce(v_name, 'User') else btrim(p_actor_name) end,
    -- An external representative's name and organisation are their stated attestation; an account's are the server's.
    case when p_attestation_method = 'account' then v_member_organization else nullif(btrim(coalesce(p_actor_organization, '')), '') end,
    case when p_attestation_method = 'account' then left(coalesce(v_member_roles, 'Project member'), 108) else btrim(p_actor_role) end
      || case when v_delegate then ' (delegate)' else '' end,
    nullif(btrim(coalesce(p_actor_role, '')), ''),
    p_attestation_method, p_signature_image, p_evidence_file_id,
    nullif(btrim(coalesce(p_comments, '')), ''), nullif(btrim(coalesce(p_return_reason, '')), ''),
    coalesce(nullif(btrim(coalesce(p_next_actor, '')), ''), (select person.display_name from public.list_project_people(p_project_id) person where person.user_id = p_next_actor_user_id)),
    p_next_actor_user_id, v_due,
    case when p_action in ('submit', 'resubmit', 'respond') then v_record end,
    v_last.new_status, v_status
  ) returning * into v_event;

  -- The record's own status follows the action (one status, set by the workflow).
  if v_status not like 'Partially Approved%' and p_action <> 'witness' then
    perform app_private.signoff_move_record(p_record_kind, p_record_id, p_action, p_workflow_profile, coalesce(v_name, 'User'));
  end if;

  -- The next responsible person hears about it; after a decision, so does the author.
  v_recipient := coalesce(p_next_actor_user_id,
    case when p_action in ('approve', 'accept', 'reject', 'return', 'verify', 'close', 'reopen') then v_creator end);
  if v_recipient is not null and v_recipient <> v_actor then
    insert into public.notifications (
      organization_id, project_id, recipient_user_id, notification_type,
      title, body, source_type, source_id, due_at, dedupe_key
    ) values (
      v_project.organization_id, p_project_id, v_recipient, 'review_requested',
      left(v_status || ': ' || v_number, 240),
      left(coalesce(v_record ->> 'title', 'Sign-off') || ' — ' || coalesce(nullif(btrim(p_comments), ''), v_status), 2000),
      'signoff', p_record_id, v_due,
      'signoff:' || v_event.id::text
    )
    on conflict (recipient_user_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;

  return v_event;
end;
$$;
