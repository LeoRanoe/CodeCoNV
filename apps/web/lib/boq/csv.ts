import { downloadBlob } from "@/lib/browser/download";
export { parseBoqCsv } from "@/lib/boq/parser.mjs";

export type BoqImportItem = {
  code: string;
  description: string;
  quantity: number | null;
  unit: string;
  unit_rate: number | null;
  contract_value: number | null;
  progress_percent: number;
  source_row: number;
};

export function downloadBoqCsvTemplate() {
  const content = "code;omschrijving;hoeveelheid;eenheid;eenheidsprijs;contractbedrag;voortgang_%\nBOQ-001;Voorbeeld werkpakket;100;m2;25.50;2550;0\n";
  downloadBlob(new Blob([content], { type: "text/csv;charset=utf-8" }), "CODECO-BOQ-importsjabloon.csv");
}
