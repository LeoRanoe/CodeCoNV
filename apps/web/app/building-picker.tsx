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

  // Few enough options to pick with one tap; a full dropdown just adds an extra step and takes more room.
  if (options.length <= 5) {
    return (
      <div className="building-picker-compact">
        <span>{fieldLabel}</span>
        <div className="quick-issue-presets">
          {options.map((option) => (
            <button
              className={option.id === value ? "active" : ""}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.id)}
              key={option.id}
            >
              {option.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <label className="form-field building-picker-field" htmlFor={id}>
      <span>{fieldLabel}</span>
      <select id={id} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}
      </select>
    </label>
  );
}
