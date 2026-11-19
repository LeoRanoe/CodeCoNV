import {
  AlertTriangle,
  Calculator,
  CalendarClock,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileDiff,
  FileText,
  FileWarning,
  Gauge,
  Handshake,
  HardHat,
  HelpCircle,
  Leaf,
  Lightbulb,
  ListChecks,
  Megaphone,
  MessagesSquare,
  NotebookPen,
  PackageCheck,
  Receipt,
  Ruler,
  ScrollText,
  ShieldCheck,
  Siren,
  TimerOff,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * One icon per form, everywhere the form appears: the Workspace tile, the heading of the
 * form itself, its rows in a list and its block in the day overview. The client reads a
 * screen by its pictures before its words, so the same form always carries the same one.
 */
export const formIcons = {
  photos: Camera,
  works_ongoing: HardHat,
  works_completed: CheckCircle2,
  workforce: Users,
  delays: TimerOff,
  delay_report: CalendarClock,
  issue: AlertTriangle,
  ncr: FileWarning,
  hse: ShieldCheck,
  hse_incident: Siren,
  inspection: ClipboardCheck,
  delivery: Truck,
  technical_instruction: Wrench,
  change_order: FileDiff,
  lessons_learned: Lightbulb,
  agreement: Handshake,
} satisfies Record<string, LucideIcon>;

export type FormIconKey = keyof typeof formIcons;

/** The register types that have no tile of their own still get an icon that says what they are. */
const registerIcons: Record<string, LucideIcon> = {
  delivery: formIcons.delivery,
  technical_instruction: formIcons.technical_instruction,
  change_order: formIcons.change_order,
  lessons_learned: formIcons.lessons_learned,
  agreement: formIcons.agreement,
  delay_report: formIcons.delay_report,
  delay: formIcons.delays,
  equipment: Gauge,
  test: Ruler,
  variation: FileDiff,
  communication: MessagesSquare,
  correspondence: MessagesSquare,
  meeting: MessagesSquare,
  risk: AlertTriangle,
  environmental_report: Leaf,
  rfi: HelpCircle,
  rfa: ListChecks,
  wcr: CheckCircle2,
  inspection_request: ClipboardCheck,
  site_instruction: Megaphone,
  cost: Calculator,
  declaration: Receipt,
  contract: ScrollText,
  specification: ScrollText,
  notepad: NotebookPen,
  punch_list: ClipboardList,
  boq: PackageCheck,
};

export function registerIcon(type: string): LucideIcon {
  return registerIcons[type] ?? FileText;
}
