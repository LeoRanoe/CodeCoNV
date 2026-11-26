"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { useState, type ComponentProps } from "react";
import { PortalApp } from "@/app/portal-app";
import { useLanguage } from "@/lib/i18n";

type PortalProps = ComponentProps<typeof PortalApp>;

/** Party types that sit on each side of the project (the client side includes the client's representatives). */
const sideTypes: Record<"contractor" | "client", string[]> = {
  contractor: ["contractor", "subcontractor", "supplier"],
  client: ["client", "consultant"],
};

/**
 * Contractor Portal and Client Portal of the Supervision menu (Word v2.0, section 3): Supervision opens the
 * portal of any contractor or client of its project, "View as: <organisation>", read-only. It shows what that
 * organisation sees; nothing done here is logged as the organisation.
 */
export function ViewAsPortal({ client, mode, projectId, onClose, ...rest }: Omit<PortalProps, "viewAs" | "onSignOut" | "submissionWorkspace"> & {
  client: SupabaseClient;
  onClose: () => void;
}) {
  const { text } = useLanguage();
  const [partyId, setPartyId] = useState("");
  const partiesQuery = useQuery({
    queryKey: ["view-as-parties", projectId, mode],
    queryFn: async () => {
      const result = await client.from("parties").select("id,name,party_type").eq("project_id", projectId).eq("active", true).order("name");
      if (result.error) throw result.error;
      return ((result.data ?? []) as Array<{ id: string; name: string; party_type: string }>).map(({ id, name, party_type }) => ({ id, name, type: party_type }));
    },
    staleTime: 5 * 60_000,
  });
  const parties = (partiesQuery.data ?? []).filter((party) => sideTypes[mode].includes(party.type));
  const selected = partyId && parties.some((party) => party.id === partyId) ? partyId : parties[0]?.id ?? "";

  if (partiesQuery.isLoading) return <p className="portal-loading">{text("Loading…", "Laden…")}</p>;
  if (!parties.length) {
    return (
      <div className="portal-shell">
        <main id="main-content" tabIndex={-1} className="portal-main">
          <p className="record-list-empty">{mode === "contractor" ? text("This project has no contractor to view as yet.", "Dit project heeft nog geen aannemer om als te bekijken.") : text("This project has no client to view as yet.", "Dit project heeft nog geen opdrachtgever om als te bekijken.")}</p>
          <button className="ui-button ui-button--secondary ui-button--md" type="button" onClick={onClose}>{text("Back", "Terug")}</button>
        </main>
      </div>
    );
  }
  return (
    <PortalApp
      {...rest}
      client={client}
      mode={mode}
      projectId={projectId}
      onSignOut={onClose}
      viewAs={{ parties: parties.map(({ id, name }) => ({ id, name })), partyId: selected, onChange: setPartyId, onClose }}
    />
  );
}
