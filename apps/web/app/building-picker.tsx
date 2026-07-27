"use client";

import { useLanguage } from "@/lib/i18n";

export type BuildingOption = { id: string; name: string };

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
}: {
  id: string;
  buildings: BuildingOption[];
  value: string;
  onChange: (buildingId: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  const { text } = useLanguage();
  if (buildings.length < 2) return null;
  return (
    <label className="form-field building-picker-field" htmlFor={id}>
      <span>{label ?? text("Building", "Gebouw")}</span>
      <select id={id} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>
        {buildings.map((building) => <option value={building.id} key={building.id}>{building.name}</option>)}
      </select>
    </label>
  );
}
