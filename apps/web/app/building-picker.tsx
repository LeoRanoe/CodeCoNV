"use client";

import { useLanguage } from "@/lib/i18n";

export type BuildingOption = { id: string; name: string };

export const ALL_BUILDINGS = "all";

export function resolveDefaultBuildingId(buildings: BuildingOption[], preferredId?: string | null): string {
  if (preferredId && buildings.some((building) => building.id === preferredId)) return preferredId;
  return buildings[0]?.id ?? "";
}

export function BuildingPicker({
  id,
  buildings,
  value,
  onChange,
  label,
  disabled = false,
  allowAll = false,
}: {
  id: string;
  buildings: BuildingOption[];
  value: string;
  onChange: (buildingId: string) => void;
  label?: string;
  disabled?: boolean;
  allowAll?: boolean;
}) {
  const { text } = useLanguage();
  if (buildings.length < 2) return null;
  const fieldLabel = label ?? text("Building", "Gebouw");
  const options = allowAll ? [{ id: ALL_BUILDINGS, name: text("All buildings", "Alle gebouwen") }, ...buildings] : buildings;

  // Always a dropdown: a row of buttons grows with every building and pushed the
  // rest of the form off screen on a phone. It must never stick to the viewport.
  return (
    <label className="form-field building-picker-field" htmlFor={id}>
      <span>{fieldLabel}</span>
      <select id={id} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}
      </select>
    </label>
  );
}

/**
 * One field record often covers more than one building — the same delay or the same
 * ongoing work. Checkboxes keep that explicit and stay readable on a phone, where a
 * native multi-select needs ctrl-click nobody has.
 */
export function BuildingMultiPicker({
  id,
  buildings,
  value,
  onChange,
  label,
  hint,
}: {
  id: string;
  buildings: BuildingOption[];
  value: string[];
  onChange: (buildingIds: string[]) => void;
  label?: string;
  hint?: string;
}) {
  const { text } = useLanguage();
  if (buildings.length < 2) return null;
  const allSelected = value.length === buildings.length;
  const toggle = (buildingId: string) => {
    const selected = new Set(value);
    if (selected.has(buildingId)) selected.delete(buildingId);
    else selected.add(buildingId);
    // Never leave the record without a building; the last checkbox stays on.
    if (!selected.size) return;
    onChange(buildings.filter((building) => selected.has(building.id)).map((building) => building.id));
  };

  return (
    <fieldset className="form-field building-multi-picker" id={id}>
      <legend>{label ?? text("Buildings", "Gebouwen")}</legend>
      <div className="building-multi-options">
        <label className={allSelected ? "active" : ""}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => onChange(allSelected ? [buildings[0].id] : buildings.map((building) => building.id))}
          />
          <span>{text("All buildings", "Alle gebouwen")}</span>
        </label>
        {buildings.map((building) => (
          <label className={value.includes(building.id) ? "active" : ""} key={building.id}>
            <input type="checkbox" checked={value.includes(building.id)} onChange={() => toggle(building.id)} />
            <span>{building.name}</span>
          </label>
        ))}
      </div>
      <small>{hint ?? text(
        "Choose one building, several, or all of them. The record is saved once per selected building.",
        "Kies één gebouw, meerdere of alle. De registratie wordt per gekozen gebouw opgeslagen.",
      )}</small>
    </fieldset>
  );
}
