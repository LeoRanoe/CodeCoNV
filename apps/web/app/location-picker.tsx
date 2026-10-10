"use client";

import { useEffect, useMemo } from "react";
import { locationBreadcrumb, locationPath, selectableLocation } from "@/lib/locations/tree.mjs";
export { locationBreadcrumb } from "@/lib/locations/tree.mjs";
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
      .filter((node) => locationPath(nodes, node.id, buildingId, true).length > 0)
      .map((node) => ({ ...node, breadcrumb: locationBreadcrumb(nodes, node.id) }))
      .sort((left, right) => left.breadcrumb.localeCompare(right.breadcrumb)),
    [buildingId, nodes],
  );
  const depthRequired = requiredDepth !== "building";
  useEffect(() => {
    if (value && !selectableLocation(nodes, value, buildingId, requiredDepth)) onChange("");
  }, [nodes, value, buildingId, requiredDepth, onChange]);
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
          <option value={node.id} key={node.id} disabled={!selectableLocation(nodes, node.id, buildingId, requiredDepth)}>
            {node.breadcrumb} · {typeText(node.node_type, text)}
          </option>
        ))}
      </select>
      {!available.length ? (
        <small>{text("No location tree for this building. Add floors, rooms or elements in Project settings.", "Geen locatieboom voor dit gebouw. Voeg verdiepingen, ruimtes of elementen toe in Projectinstellingen.")}</small>
      ) : null}
    </label>
  );
}
