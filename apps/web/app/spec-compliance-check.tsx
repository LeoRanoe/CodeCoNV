"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SignatureField, type HandwrittenSignature } from "@/app/signature-pad";
import { useLanguage } from "@/lib/i18n";
import { complianceRowResults, complianceVerdict, flagSupersededChecks } from "@/lib/verification/spec-compliance.mjs";
import { createFinding, type FileRecord } from "@/lib/supabase/operations";

type ComplianceRow = { parameter: string; required: string; submitted: string; result: "complies" | "does_not_comply" | "not_stated" | "not_applicable"; comment: string; page: string };

type StoredCheck = {
  id: string;
  check_number: string;
  subject_file_id: string | null;
  subject_label: string;
  requirement_file_id: string | null;
  requirement_label: string;
  clause: string;
  material_group: string | null;
  rows: ComplianceRow[];
  overall_result: "complies" | "complies_with_comments" | "does_not_comply";
  comments: string | null;
  signed_by: string;
  signed_at: string;
  follow_up_finding_id: string | null;
};

const resultLabels = {
  complies: { en: "Complies", nl: "Voldoet" },
  does_not_comply: { en: "Does not comply", nl: "Voldoet niet" },
  not_stated: { en: "Not stated", nl: "Niet vermeld" },
  not_applicable: { en: "N/A", nl: "N.v.t." },
} as const;

const overallLabels = {
  complies: { en: "Complies", nl: "Voldoet" },
  complies_with_comments: { en: "Complies with comments", nl: "Voldoet met opmerkingen" },
  does_not_comply: { en: "Does not comply", nl: "Voldoet niet" },
} as const;

const emptyRow = (): ComplianceRow => ({ parameter: "", required: "", submitted: "", result: "complies", comment: "", page: "" });

/**
 * Word 10.1 "Spec compliance check": a submittal (revision) is compared with a bestek clause, one row per
 * requirement, and the supervisor signs the overall result. The check is stored with both document
 * revisions; a failed check starts an NCR; a check whose documents have since been superseded is flagged.
 */
export function SpecComplianceCheck({ client, projectId, projectFiles, buildingId, currentUserName, canVerify }: {
  client: SupabaseClient;
  projectId: string;
  projectFiles: FileRecord[];
  buildingId: string;
  currentUserName: string;
  canVerify: boolean;
}) {
  const { language, locale, text } = useLanguage();
  const documents = useMemo(() => projectFiles.filter((file) => file.category !== "photo" && file.category !== "drawing" && file.mime_type !== "image/jpeg"), [projectFiles]);
  const [subjectId, setSubjectId] = useState("");
  const [requirementId, setRequirementId] = useState("");
  const [clause, setClause] = useState("");
  const [materialGroup, setMaterialGroup] = useState("");
  const [rows, setRows] = useState<ComplianceRow[]>([emptyRow()]);
  const [comments, setComments] = useState("");
  const [signature, setSignature] = useState<HandwrittenSignature | null>(null);
  const [checks, setChecks] = useState<StoredCheck[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<StoredCheck | null>(null);

  const fetchChecks = useCallback(async () => {
    return client.from("spec_compliance_checks")
      .select("id,check_number,subject_file_id,subject_label,requirement_file_id,requirement_label,clause,material_group,rows,overall_result,comments,signed_by,signed_at,follow_up_finding_id")
      .eq("project_id", projectId).order("created_at", { ascending: false }).limit(50);
  }, [client, projectId]);
  const load = useCallback(async () => {
    const result = await fetchChecks();
    if (!result.error) setChecks((result.data ?? []) as StoredCheck[]);
  }, [fetchChecks]);
  useEffect(() => {
    let alive = true;
    void fetchChecks().then((result) => { if (alive && !result.error) setChecks((result.data ?? []) as StoredCheck[]); });
    return () => { alive = false; };
  }, [fetchChecks]);

  // "The last used clause for the same material group is suggested."
  const suggestedClause = useMemo(() => {
    if (!materialGroup.trim()) return "";
    return checks.find((check) => (check.material_group ?? "").toLowerCase() === materialGroup.trim().toLowerCase())?.clause ?? "";
  }, [checks, materialGroup]);

  const subject = documents.find((file) => file.id === subjectId);
  const requirement = documents.find((file) => file.id === requirementId);
  const verdict = complianceVerdict(rows, comments) as keyof typeof overallLabels;
  const rowProblem = rows.some((row) => !row.parameter.trim());
  const ready = Boolean(subject && requirement && clause.trim() && rows.length && !rowProblem && signature?.image);
  const stateLabel = (fileId: string | null) => {
    const file = projectFiles.find((item) => item.id === fileId);
    return file ? file.status : "";
  };
  const flagged = useMemo(() => (flagSupersededChecks as (checks: StoredCheck[], isSuperseded: (fileId: string) => boolean) => Array<{ check: StoredCheck; superseded: boolean }>)(checks, (fileId: string | null) => stateLabel(fileId) === "superseded"), [checks, projectFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  const setRow = (index: number, patch: Partial<ComplianceRow>) => setRows((current) => current.map((row, position) => (position === index ? { ...row, ...patch } : row)));

  const save = async () => {
    if (!ready || !subject || !requirement || !signature) return;
    setBusy(true);
    setError("");
    const result = await client.rpc("record_spec_compliance_check", {
      p_project_id: projectId,
      p_subject_kind: "document",
      p_subject_file_id: subject.id,
      p_subject_record_id: null,
      p_subject_label: `${subject.original_name}${subject.document_code ? ` · ${subject.document_code}` : ""}`,
      p_requirement_file_id: requirement.id,
      p_requirement_label: `${requirement.original_name}${requirement.document_code ? ` · ${requirement.document_code}` : ""}`,
      p_clause: clause.trim(),
      p_material_group: materialGroup.trim() || null,
      p_rows: rows.map((row) => ({ ...row, parameter: row.parameter.trim() })),
      p_comments: comments.trim() || null,
      p_proposed_by_assistant: false,
      p_signed_by: signature.name,
      p_signature_image: signature.image,
      p_idempotency_key: `spec-check:${crypto.randomUUID()}`,
    });
    setBusy(false);
    if (result.error) { setError(result.error.message); return; }
    setSaved(result.data as StoredCheck);
    setRows([emptyRow()]);
    setComments("");
    setSignature(null);
    await load();
  };

  /** "Does not comply → one tap creates an NCR (pre-filled)". */
  const createNcr = async (check: StoredCheck) => {
    setBusy(true);
    setError("");
    try {
      const failed = check.rows.filter((row) => row.result === "does_not_comply");
      const finding = await createFinding(client, {
        projectId,
        buildingId,
        type: "ncr",
        title: `${check.subject_label} — ${text("does not comply with", "voldoet niet aan")} ${check.clause}`.slice(0, 240),
        description: [
          `${text("Spec compliance check", "Bestekcontrole")} ${check.check_number}: ${check.subject_label} ${text("against", "tegen")} ${check.requirement_label} (${check.clause}).`,
          ...failed.map((row) => `• ${row.parameter}: ${text("required", "vereist")} ${row.required || "—"}, ${text("submitted", "aangeboden")} ${row.submitted || "—"}${row.page ? ` (p. ${row.page})` : ""}${row.comment ? ` — ${row.comment}` : ""}`),
        ].join("\n"),
        severity: "medium",
        idempotencyKey: `spec-check-ncr:${check.id}`,
      });
      const link = await client.rpc("link_spec_check_follow_up", { p_check_id: check.id, p_finding_id: (finding as { id: string }).id });
      if (link.error) throw link.error;
      await load();
      setSaved(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const fileOption = (file: FileRecord) => <option value={file.id} key={file.id}>{file.original_name}{file.document_code ? ` · ${file.document_code}` : ""}{file.status === "superseded" ? ` (${text("superseded", "vervangen")})` : ""}</option>;
  const when = (stamp: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Paramaribo" }).format(new Date(stamp));

  return (
    <section className="spec-compliance" aria-label={text("Spec compliance check", "Bestekcontrole")}>
      <p className="form-intro">{text("Compare a submittal with the bestek clause it must meet. One row per requirement; the overall result is signed and stored with both documents.", "Vergelijk een inzending met het bestekartikel waaraan ze moet voldoen. Eén rij per eis; het totaalresultaat wordt getekend en met beide documenten bewaard.")}</p>
      {canVerify ? (
        <div className="spec-compliance-form">
          <div className="form-grid-2">
            <label className="form-field"><span>{text("Submittal / datasheet to check", "Inzending / datasheet om te controleren")}</span>
              <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">{text("Choose a document", "Kies een document")}</option>{documents.map(fileOption)}</select>
            </label>
            <label className="form-field"><span>{text("Bestek / specification", "Bestek / specificatie")}</span>
              <select value={requirementId} onChange={(event) => setRequirementId(event.target.value)}><option value="">{text("Choose a document", "Kies een document")}</option>{documents.map(fileOption)}</select>
            </label>
            <label className="form-field"><span>{text("Material group (optional)", "Materiaalgroep (optioneel)")}</span>
              <input value={materialGroup} maxLength={120} onChange={(event) => setMaterialGroup(event.target.value)} />
            </label>
            <label className="form-field"><span>{text("Section / clause", "Artikel / paragraaf")}</span>
              <input value={clause} maxLength={240} placeholder={text("e.g. Bestek § 4.3 Beton", "bv. Bestek § 4.3 Beton")} onChange={(event) => setClause(event.target.value)} />
              {suggestedClause && !clause ? <button className="ui-button ui-button--quiet ui-button--md" type="button" onClick={() => setClause(suggestedClause)}>{text(`Use last clause: ${suggestedClause}`, `Laatst gebruikt: ${suggestedClause}`)}</button> : null}
            </label>
          </div>

          <div className="spec-compliance-table" role="table" aria-label={text("Comparison table", "Vergelijkingstabel")}>
            <div className="spec-compliance-head" role="row">
              <span>{text("Parameter", "Parameter")}</span><span>{text("Required (bestek)", "Vereist (bestek)")}</span><span>{text("Submitted", "Aangeboden")}</span><span>{text("Result", "Resultaat")}</span><span>{text("Comment", "Opmerking")}</span><span>{text("Page", "Pagina")}</span><span />
            </div>
            {rows.map((row, index) => (
              <div className="spec-compliance-row" role="row" key={index}>
                <input aria-label={text("Parameter", "Parameter")} value={row.parameter} maxLength={120} placeholder={text("Strength class, thickness, standard…", "Sterkteklasse, dikte, norm…")} onChange={(event) => setRow(index, { parameter: event.target.value })} />
                <input aria-label={text("Required value", "Vereiste waarde")} value={row.required} maxLength={240} onChange={(event) => setRow(index, { required: event.target.value })} />
                <input aria-label={text("Submitted value", "Aangeboden waarde")} value={row.submitted} maxLength={240} onChange={(event) => setRow(index, { submitted: event.target.value })} />
                <select aria-label={text("Result", "Resultaat")} value={row.result} onChange={(event) => setRow(index, { result: event.target.value as ComplianceRow["result"] })}>
                  {(complianceRowResults as Array<keyof typeof resultLabels>).map((result) => <option value={result} key={result}>{text(resultLabels[result].en, resultLabels[result].nl)}</option>)}
                </select>
                <input aria-label={text("Comment", "Opmerking")} value={row.comment} maxLength={500} onChange={(event) => setRow(index, { comment: event.target.value })} />
                <input aria-label={text("Page reference", "Paginaverwijzing")} value={row.page} maxLength={40} onChange={(event) => setRow(index, { page: event.target.value })} />
                <button className="ui-button ui-button--quiet ui-button--md" type="button" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((_, position) => position !== index))} aria-label={text("Remove row", "Rij verwijderen")}><Trash2 size={14} /></button>
              </div>
            ))}
            <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={() => setRows((current) => [...current, emptyRow()])}><Plus size={14} /> {text("Add row", "Rij toevoegen")}</button>
          </div>

          <label className="form-field"><span>{text("Comments on the whole check", "Opmerkingen bij de hele controle")}</span><textarea rows={2} maxLength={2000} value={comments} onChange={(event) => setComments(event.target.value)} /></label>
          <p className={`spec-compliance-verdict ${verdict}`} role="status"><strong>{text("Overall result", "Totaalresultaat")}:</strong> {text(overallLabels[verdict].en, overallLabels[verdict].nl)}</p>
          <SignatureField
            label={text("Sign the result", "Onderteken het resultaat")}
            declaration={text("I have compared the submittal with the specification and confirm this result.", "Ik heb de inzending met het bestek vergeleken en bevestig dit resultaat.")}
            nameSuggestion={currentUserName}
            lockName
            value={signature}
            onChange={setSignature}
          />
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy || !ready} onClick={() => void save()}>
            {busy ? <Loader2 className="spin" size={15} /> : <CheckCircle2 size={15} />} {text("Sign and store the check", "Controle ondertekenen en bewaren")}
          </button>
        </div>
      ) : <p className="form-helper">{text("Only a verifier can record a compliance check.", "Alleen een verificateur kan een bestekcontrole vastleggen.")}</p>}

      {saved && saved.overall_result === "does_not_comply" && !saved.follow_up_finding_id ? (
        <div className="operation-alert warning"><AlertTriangle size={17} /><div><strong>{text("Does not comply", "Voldoet niet")}</strong><span>{saved.check_number}</span></div>
          <button className="ui-button ui-button--primary ui-button--md" type="button" disabled={busy} onClick={() => void createNcr(saved)}>{text("Create NCR", "NCR aanmaken")}</button>
        </div>
      ) : null}

      <h3>{text("Stored checks", "Bewaarde controles")}</h3>
      {flagged.length ? (
        <ul className="spec-compliance-list">
          {flagged.map(({ check, superseded }) => (
            <li key={check.id}>
              <strong>{check.check_number}</strong> · {text(overallLabels[check.overall_result].en, overallLabels[check.overall_result].nl)}
              <span>{check.subject_label} → {check.requirement_label} · {check.clause} · {check.signed_by} · {when(check.signed_at)}</span>
              {superseded ? <em className="spec-compliance-superseded">{text("Based on superseded revision", "Gebaseerd op vervangen revisie")}</em> : null}
              {check.overall_result === "does_not_comply" && !check.follow_up_finding_id && canVerify ? <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={busy} onClick={() => void createNcr(check)}>{text("Create NCR", "NCR aanmaken")}</button> : null}
              {check.follow_up_finding_id ? <small>{text("NCR created", "NCR aangemaakt")}</small> : null}
            </li>
          ))}
        </ul>
      ) : <small>{text("No checks recorded yet.", "Nog geen controles vastgelegd.")}</small>}
      <span hidden>{language}</span>
    </section>
  );
}
