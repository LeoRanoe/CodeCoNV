"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n";

type Party = { id: string; code: string; name: string; party_type: string };
type Contact = { id: string; party_id: string; name: string; job_title: string | null; email: string | null; phone: string | null; is_primary: boolean };

const typeLabels: Record<string, { en: string; nl: string }> = {
  client: { en: "Client", nl: "Opdrachtgever" },
  contractor: { en: "Contractor", nl: "Aannemer" },
  subcontractor: { en: "Subcontractor", nl: "Onderaannemer" },
  supplier: { en: "Supplier", nl: "Leverancier" },
  consultant: { en: "Consultant", nl: "Adviseur" },
  inspector: { en: "Inspector", nl: "Inspecteur" },
};

/**
 * Management → Contractors & Consultants (Word 13), the Project Company Register: the companies of the
 * project with their contacts. The dropdowns Responsible party, Issued to, Workforce contractor and
 * Supplier read the companies; the contacts are the people a record is addressed to.
 */
export function CompanyRegister({ client, projectId, canEdit }: { client: SupabaseClient; projectId: string; canEdit: boolean }) {
  const { language, text } = useLanguage();
  const queryClient = useQueryClient();
  const key = ["company-register", projectId];
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [parties, contacts] = await Promise.all([
        client.from("parties").select("id,code,name,party_type").eq("project_id", projectId).eq("active", true).order("name"),
        client.from("party_contacts").select("id,party_id,name,job_title,email,phone,is_primary").eq("project_id", projectId).eq("active", true).order("name"),
      ]);
      if (parties.error) throw parties.error;
      if (contacts.error) throw contacts.error;
      return { parties: (parties.data ?? []) as Party[], contacts: (contacts.data ?? []) as Contact[] };
    },
  });
  const [draft, setDraft] = useState<{ partyId: string; name: string; jobTitle: string; email: string; phone: string }>({ partyId: "", name: "", jobTitle: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const add = async (partyId: string) => {
    if (draft.partyId !== partyId || draft.name.trim().length < 2) return;
    setBusy(true);
    setError("");
    const existing = query.data?.contacts.filter((contact) => contact.party_id === partyId) ?? [];
    const result = await client.from("party_contacts").insert({
      project_id: projectId,
      party_id: partyId,
      name: draft.name.trim(),
      job_title: draft.jobTitle.trim() || null,
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
      is_primary: existing.length === 0,
    });
    setBusy(false);
    if (result.error) { setError(result.error.message); return; }
    setDraft({ partyId: "", name: "", jobTitle: "", email: "", phone: "" });
    await refresh();
  };

  const remove = async (id: string) => {
    setBusy(true);
    const result = await client.from("party_contacts").update({ active: false }).eq("id", id);
    setBusy(false);
    if (result.error) setError(result.error.message);
    await refresh();
  };

  if (query.isLoading) return <p className="portal-loading"><Loader2 className="spin" size={15} /> {text("Loading…", "Laden…")}</p>;
  if (query.error) return <p className="field-error" role="alert">{(query.error as Error).message}</p>;
  const { parties = [], contacts = [] } = query.data ?? {};

  return (
    <section className="operation-panel company-register" aria-label={text("Contractors & consultants", "Aannemers & adviseurs")}>
      <div className="operation-form-heading"><div><h2><Building2 size={18} aria-hidden="true" /> {text("Contractors & consultants", "Aannemers & adviseurs")}</h2></div></div>
      <p className="form-intro">{text("The companies of this project and their contacts. The lists Responsible party, Issued to, Workforce contractor and Supplier use this register.", "De bedrijven van dit project en hun contactpersonen. De lijsten Verantwoordelijke partij, Uitgegeven aan, Aannemer personeel en Leverancier gebruiken dit register.")}</p>
      {!parties.length ? <p className="form-helper">{text("No companies yet. Add them under Portals.", "Nog geen bedrijven. Voeg ze toe onder Portalen.")}</p> : null}
      <ul className="company-register-list">
        {parties.map((party) => {
          const own = contacts.filter((contact) => contact.party_id === party.id);
          return (
            <li key={party.id}>
              <header><strong>{party.name}</strong><span>{party.code} · {typeLabels[party.party_type] ? typeLabels[party.party_type][language === "en" ? "en" : "nl"] : party.party_type}</span></header>
              {own.length ? (
                <ul>
                  {own.map((contact) => (
                    <li key={contact.id}>
                      <span><strong>{contact.name}</strong>{contact.is_primary ? ` · ${text("primary", "hoofdcontact")}` : ""}{contact.job_title ? ` · ${contact.job_title}` : ""}</span>
                      <small>{[contact.email, contact.phone].filter(Boolean).join(" · ")}</small>
                      {canEdit ? <button className="ui-button ui-button--quiet ui-button--md" type="button" disabled={busy} onClick={() => void remove(contact.id)} aria-label={text(`Remove ${contact.name}`, `${contact.name} verwijderen`)}><Trash2 size={14} /></button> : null}
                    </li>
                  ))}
                </ul>
              ) : <small>{text("No contacts yet.", "Nog geen contactpersonen.")}</small>}
              {canEdit ? (
                <div className="company-contact-form">
                  <input aria-label={text("Contact name", "Naam contactpersoon")} placeholder={text("Name", "Naam")} value={draft.partyId === party.id ? draft.name : ""} maxLength={120} onChange={(event) => setDraft({ ...draft, partyId: party.id, name: event.target.value })} />
                  <input aria-label={text("Job title", "Functie")} placeholder={text("Job title", "Functie")} value={draft.partyId === party.id ? draft.jobTitle : ""} maxLength={120} onChange={(event) => setDraft({ ...draft, partyId: party.id, jobTitle: event.target.value })} />
                  <input aria-label="E-mail" type="email" placeholder="E-mail" value={draft.partyId === party.id ? draft.email : ""} maxLength={160} onChange={(event) => setDraft({ ...draft, partyId: party.id, email: event.target.value })} />
                  <input aria-label={text("Phone", "Telefoon")} placeholder={text("Phone", "Telefoon")} value={draft.partyId === party.id ? draft.phone : ""} maxLength={40} onChange={(event) => setDraft({ ...draft, partyId: party.id, phone: event.target.value })} />
                  <button className="ui-button ui-button--secondary ui-button--md" type="button" disabled={busy || draft.partyId !== party.id || draft.name.trim().length < 2} onClick={() => void add(party.id)}><Plus size={14} /> {text("Add contact", "Contact toevoegen")}</button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </section>
  );
}
