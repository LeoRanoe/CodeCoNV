import {
  Archive, BadgeCheck, Ban, Banknote, BellRing, Briefcase, BrickWall, Building2, CalendarClock, CalendarDays, CalendarRange,
  CalendarX, Check, Circle, CircleCheck, CircleDashed, CircleDot, CircleHelp, CircleMinus, CirclePause, CircleX, Clock,
  ClockAlert, DollarSign, Ellipsis, Euro, Eye, FileCheck, FilePen, FileWarning, FileX, Forward, Gauge, Hammer, HardHat,
  HeartPulse, Hourglass, Layers, Leaf, Lock, LogOut, MessageSquareText, Microscope, Moon, Mountain, Network, PackageOpen,
  PencilRuler, PersonStanding, RectangleHorizontal, RectangleVertical, Replace, ScanSearch, Send, Share2, ShieldX, Square,
  Sun, Sunset, Target, Trash2, TreePalm, TrendingUp, TriangleAlert, Truck, UserCheck, UserMinus, Users, UserX, Wrench, X,
  Award, Ambulance, Building, Coins, Construction, Crop, Fence, Flame, Handshake, Megaphone, OctagonX, Package, PackageX,
  Split, Thermometer, Sprout, Umbrella, Cloud, CloudDrizzle, CloudLightning, CloudRain, FlaskConical, PackageMinus, PackagePlus,
  RotateCcw, Ruler, Tag,
  type LucideIcon,
} from "lucide-react";

/**
 * Pictures for the choices of a short list (client, 20-11-2026: "a custom icon or SVG that tells
 * the choices apart easily"). Each workbook value has its own shape, so two choices of one list
 * never look alike. Scales (priority, likelihood, severity) get a level gauge instead: the number
 * of filled bars is the step on the scale.
 */
const pictures: Record<string, LucideIcon> = {
  // Workflow status
  "Open": CircleDot, "Assigned": UserCheck, "In Progress": CircleDashed, "Pending Verification": ScanSearch, "Closed": CircleCheck, "Cancelled": Ban,
  // NCR disposition and verification
  "Rework": Hammer, "Repair": Wrench, "Use As Is (with approved concession)": FileCheck, "Reject / Replace": Replace, "Scrap": Trash2,
  "Further Technical Evaluation Required": Microscope, "Effective": CircleCheck, "Not Effective": CircleX, "Rework Required": Hammer, "Pending": Hourglass,
  // HSE
  "Safety": HardHat, "Health": HeartPulse, "Environment": Leaf, "Unsafe Act": PersonStanding, "Unsafe Condition": TriangleAlert, "HSE Observation": Eye,
  "Not Required": CircleMinus, "Notified": BellRing, "Yes": Check, "No": X, "To Be Determined": CircleHelp,
  // Deliveries
  "Scheduled": CalendarClock, "Arrived On Time": Truck, "Delayed": ClockAlert, "Partial Delivery": PackageOpen,
  "Accepted": CircleCheck, "Accepted with Comments": MessageSquareText, "Quarantined": Lock, "Rejected": CircleX, "Pending Inspection": Hourglass,
  // Technical instruction and change order
  "Design clarification": PencilRuler, "Site condition": Mountain, "Coordination": Users, "Specification conflict": FileWarning, "Client request": Briefcase,
  "SRD": Banknote, "USD": DollarSign, "EUR": Euro, "Hours": Clock, "Calendar Days": CalendarDays, "Working Days": CalendarRange,
  "Not Issued": FileX, "Issued": FileCheck,
  // Delay, lessons, photos
  "Actual": Target, "Estimated": Gauge,
  "Current Project": Building2, "Future Projects": Forward, "Specific Discipline": Wrench, "Organization-wide": Network,
  "Draft": FilePen, "Submitted": Send, "Reviewed": Eye, "Approved for Sharing": Share2, "Archived": Archive,
  "Progress Documentation": TrendingUp, "Site Conditions": Mountain, "Technical / Quality Evidence": BadgeCheck, "HSE Evidence": HardHat,
  // Works and workforce
  "Day": Sun, "Evening": Sunset, "Night": Moon, "Not Started": Circle, "On Hold": CirclePause, "Completed": CircleCheck,
  "Slab": Square, "Beam": RectangleHorizontal, "Column": RectangleVertical, "Footing": Layers, "Wall": BrickWall,
  "Completed - Awaiting Inspection": Hourglass, "Inspected - Accepted": CircleCheck, "Inspected - Rejected": CircleX, "Not Applicable": CircleMinus,
  "Present": UserCheck, "Absent": UserX, "Late": ClockAlert, "On Leave": TreePalm, "Off Shift": UserMinus, "Demobilized": LogOut,
  "Verified": BadgeCheck, "Expired": CalendarX, "Not Compliant": ShieldX,
  // Impact, consequence and containment (tick-box lists)
  "Cost": Coins, "Schedule": CalendarClock, "Quality": Award, "Scope": Crop, "Resources": Package, "Client": Handshake,
  "Injury": Ambulance, "Illness": Thermometer, "Property Damage": Building, "Fire": Flame, "Environmental Harm": Sprout, "Public Impact": Megaphone,
  "Stop affected work / suspend activity": OctagonX, "Isolate or quarantine nonconforming materials": Lock, "Segregate affected work or products": Split,
  "Prevent use or installation of affected materials": PackageX, "Remove defective work from service / restrict access": Fence,
  "Provide temporary protection or safety measures": Umbrella, "Implement temporary repair / make-safe measure": Construction,
  "Increase inspection, testing or monitoring": ScanSearch, "Notify responsible supervisor / contractor / consultant": BellRing,
  "Not applicable (justification required)": CircleMinus,
  "None": CircleMinus, "No Injury": CircleCheck, "Under Assessment": ScanSearch,
  // Delivery discrepancy, weather and inspection findings (developer package v5)
  "Quantity Shortage": PackageMinus, "Excess Quantity": PackagePlus, "Wrong Specification": FileWarning, "Damaged in Transit": PackageX,
  "Missing Documentation": FileX, "Expired / Shelf-Life Concern": CalendarX, "Packaging / Labelling Issue": Tag,
  "Submitted (shared)": Share2,
  "Dry / sunny": Sun, "Cloudy": Cloud, "Light rain": CloudDrizzle, "Heavy rain": CloudRain, "Thunderstorm": CloudLightning,
  "Re-inspection Required": RotateCcw, "Not Ready for Inspection": ClockAlert,
  "Workmanship Defect": Hammer, "Dimensional Deviation": Ruler, "Material Non-Compliance": ShieldX, "Incomplete Work": CircleDashed,
  "Documentation Missing": FileX, "Test Failure": FlaskConical, "Access / Safety Concern": TriangleAlert, "Other Finding": Ellipsis,
  "Other": Ellipsis,
};

/** Values of a scale field that are not a step on it. */
const offScale = /^(other|none|no injury|under assessment)$/i;

/** Fields whose choices are steps on one scale, lowest first. */
const scales = new Set(["priority", "severity", "risk_likelihood", "risk_severity", "risk_rating", "incident_severity", "property_damage", "injury_classification"]);

export const isScaleField = (key: string) => scales.has(key);

/** The step gauge of a scale: as many filled bars as the step, out of the length of the scale. */
export function LevelGlyph({ step, of }: { step: number; of: number }) {
  const gap = 2;
  const width = (26 - (of - 1) * gap) / of;
  return (
    <svg className="choice-icon choice-level" width={28} height={22} viewBox="0 0 28 22" aria-hidden="true" focusable="false">
      {Array.from({ length: of }, (_, index) => {
        const height = 6 + (14 * (index + 1)) / of;
        const reached = index < step;
        return (
          <rect key={index} x={1 + index * (width + gap)} y={21 - height} width={width} height={height} rx={1.5}
            fill={reached ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.25} strokeOpacity={reached ? 1 : 0.45} />
        );
      })}
    </svg>
  );
}

/** A plain letter in a circle, for a value without its own picture (lists an administrator added). */
function LetterGlyph({ value }: { value: string }) {
  const letter = (value.trim()[0] ?? "?").toUpperCase();
  return (
    <svg className="choice-icon" width={20} height={20} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx={10} cy={10} r={8.5} fill="none" stroke="currentColor" strokeWidth={1.5} />
      <text x={10} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill="currentColor">{letter}</text>
    </svg>
  );
}

/** The picture of one choice; on a scale field, its step among the list's steps. */
export function ChoiceIcon({ fieldKey, value, choices }: { fieldKey: string; value: string; choices: string[] }) {
  if (isScaleField(fieldKey) && !offScale.test(value)) {
    const steps = choices.filter((choice) => !offScale.test(choice));
    return <LevelGlyph step={steps.indexOf(value) + 1} of={steps.length} />;
  }
  const Picture = pictures[value];
  return Picture ? <Picture className="choice-icon" size={20} aria-hidden="true" /> : <LetterGlyph value={value} />;
}
