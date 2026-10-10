"use client";

import { useMemo } from "react";
import { useLanguage } from "@/lib/i18n";
import { typeText } from "@/lib/status-labels";

export type ProjectLocationOption = {
  id: string;
  building_id: string;
  parent_id: string | null;
  node_type: string;
  code: string;
  name: string;
  status: string;
};

export function locationBreadcrumb(
  nodes: ProjectLocationOption[],
  locationNodeId: string | null | undefined,
) {
  if (!locationNodeId) return "";
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const labels: string[] = [];
  const visited = new Set<string>();
  let current = byId.get(locationNodeId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    labels.unshift(`${current.code} · ${current.name}`);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return labels.join(" → ");
}

export function LocationPicker({
  id,
  nodes,
  buildingId,
  value,
  onChange,
  requiredDepth = "building",
}: {
  id: string;
  nodes: ProjectLocationOption[];
  buildingId: string;
  value: string;
  onChange: (value: string) => void;
  requiredDepth?: "building" | "floor" | "room" | "element";
}) {
  const { text } = useLanguage();
  const available = useMemo(
    () => nodes
      .filter((node) => node.building_id === buildingId && node.status === "active")
      .map((node) => ({ ...node, breadcrumb: locationBreadcrumb(nodes, node.id) }))
      .sort((left, right) => left.breadcrumb.localeCompare(right.breadcrumb)),
    [buildingId, nodes],
  );
  const depthRequired = requiredDepth !== "building";
  // Without a location tree this field can only say "no deeper location" and repeat that
  // no tree exists. That is noise in every form, so it stays away until it can be used.
  if (!available.length && !depthRequired) return null;
  const depthLabel = {
    building: text("Building only", "Alleen gebouw"),
    floor: text("floor", "verdieping"),
    room: text("room", "ruimte"),
    element: text("element", "element"),
  }[requiredDepth];

  return (
    <label className="form-field" htmlFor={id}>
      <span>{text("Exact project location", "Exacte projectlocatie")}{depthRequired ? " *" : ""}</span>
      <select id={id} value={value} required={depthRequired} onChange={(event) => onChange(event.target.value)}>
        <option value="">
          {depthRequired
            ? text(`Select at least a ${depthLabel}`, `Kies minimaal een ${depthLabel}`)
            : text("No deeper location · building level", "Geen diepere locatie · gebouwniveau")}
        </option>
        {available.map((node) => (
          <option value={node.id} key={node.id}>
            {node.breadcrumb} · {typeText(node.node_type, text)}
          </option>
        ))}
      </select>
      {!available.length ? (
        <small>{text(
          "No location tree exists for this building yet. Add floors, rooms or elements in Project settings.",
          "Voor dit gebouw bestaat nog geen locatieboom. Voeg verdiepingen, ruimten of elementen toe bij Projectinstellingen.",
        )}</small>
      ) : null}
    </label>
  );
}
