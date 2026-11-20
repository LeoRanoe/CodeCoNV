"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useState } from "react";
import { SpecFields } from "@/app/forms/spec-fields";
import { cleanSpecValues, type SpecValues } from "@/lib/forms/spec-forms";
import { useLanguage } from "@/lib/i18n";
import { updateInspectionSpec } from "@/lib/supabase/operations";

/**
 * Inspections keep their checklist (client, 20-11-2026); they carry the workbook's shared
 * classification — discipline, the work they inspect, the contractor's witness — so they link
 * and filter like every other record.
 */
export function InspectionSpecEditor({ client, inspectionId, values, busy, run }: {
  client: SupabaseClient;
  inspectionId: string;
  values: SpecValues;
  busy: boolean;
  run: (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
}) {
  const { language, text } = useLanguage();
  const [draft, setDraft] = useState<SpecValues>({ ...values, __stored: "yes" });
  const changed = JSON.stringify(cleanSpecValues("inspection", draft)) !== JSON.stringify(cleanSpecValues("inspection", values));
  return (
    <div className="media-detail-spec">
      <SpecFields form="inspection" values={draft} onChange={setDraft} text={text} language={language} heading={text("Classification and links", "Classificatie en koppelingen")} />
      <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={busy || !changed} onClick={() => void run(() => updateInspectionSpec(client, inspectionId, cleanSpecValues("inspection", draft)), text("Inspection classification saved.", "Classificatie van de inspectie opgeslagen."))}>
        {text("Save classification", "Classificatie opslaan")}
      </button>
    </div>
  );
}
