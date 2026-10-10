"use client";

import { Check } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export type BuildingOption = { id: string; name: string };

export const ALL_BUILDINGS = "all";

export function resolveDefaultBuildingId(buildings: BuildingOption[], preferredId?: string | null): string {
  if (preferredId && buildings.some((building) => building.id === preferredId)) return preferredId;
  return buildings[0]?.id ?? "";
}

type SingleBuildingPickerProps = {
  id: string;
  buildings: BuildingOption[];
  value: string;
  onChange: (buildingId: string) => void;
  label?: string;
  disabled?: boolean;
  allowAll?: boolean;
  multiple?: false;
  hint?: string;
};

type MultiBuildingPickerProps = {
  id: string;
  buildings: BuildingOption[];
  value: string[];
  onChange: (buildingIds: string[]) => void;
  label?: string;
  disabled?: boolean;
  multiple: true;
  hint?: string;
  allowAll?: never;
};

export function BuildingPicker(props: SingleBuildingPickerProps | MultiBuildingPickerProps) {
  const { text } = useLanguage();
  const { id, buildings, label, disabled = false } = props;
  if (buildings.length < 2) return null;
  if (props.multiple) {
    const allSelected = props.value.length === buildings.length;
    const toggle = (buildingId: string) => {
      const selected = new Set(props.value);
      if (selected.has(buildingId)) selected.delete(buildingId);
      else selected.add(buildingId);
      if (!selected.size) return;
      props.onChange(buildings.filter((building) => selected.has(building.id)).map((building) => building.id));
    };
    return (
      <fieldset className="form-field building-multi-picker" id={id} disabled={disabled}>
        <legend>{label ?? text("Buildings", "Gebouwen")}</legend>
        <div className="building-multi-options">
          <label className={allSelected ? "active" : ""}>
            <input type="checkbox" checked={allSelected} onChange={() => props.onChange(allSelected ? [buildings[0].id] : buildings.map((building) => building.id))} />
            <span>{text("All buildings", "Alle gebouwen")}</span>
          </label>
          {buildings.map((building) => (
            <label className={props.value.includes(building.id) ? "active" : ""} key={building.id}>
              <input type="checkbox" checked={props.value.includes(building.id)} onChange={() => toggle(building.id)} />
              <span>{building.name}</span>
            </label>
          ))}
        </div>
        <small>{props.hint ?? text("One numbered record is filed under every selected building.", "Eén genummerde registratie wordt onder elk gekozen gebouw vastgelegd.")}</small>
      </fieldset>
    );
  }
  const fieldLabel = label ?? text("Building", "Gebouw");
  const options = props.allowAll ? [{ id: ALL_BUILDINGS, name: text("All buildings", "Alle gebouwen") }, ...buildings] : buildings;

  // Always a dropdown: a row of buttons grows with every building and pushed the
  // rest of the form off screen on a phone. It must never stick to the viewport.
  return (
    <label className="form-field building-picker-field" htmlFor={id}>
      <span>{fieldLabel}</span>
      <select id={id} disabled={disabled} value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        {options.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}
      </select>
    </label>
  );
}

/** Above this many buildings a row of buttons stops being faster than a list. */
const maxChoiceButtons = 8;

/**
 * The building of a photo, as buttons instead of a dropdown — what the client asked for on
 * the capture screen: "laten we met knopjes werken, en meerdere kiezen". One tap with a glove
 * on beats opening a list, choosing and closing it, and one picture regularly covers two
 * buildings at once.
 *
 * A very long list of buildings would push the rest of the form off a phone screen, which is
 * why this used to be a dropdown. So the buttons hold up to eight buildings and a bigger
 * project falls back to the list it had before.
 */
export function BuildingChoiceField({
  id,
  buildings,
  value,
  onChange,
  label,
  hint,
}: {
  id: string;
  buildings: BuildingOption[];
  /** Always at least one building; the last chosen one cannot be switched off. */
  value: string[];
  onChange: (buildingIds: string[]) => void;
  label?: string;
  hint?: string;
}) {
  const { text } = useLanguage();
  if (buildings.length < 2) return null;
  const fieldLabel = label ?? text("Building", "Gebouw");
  const inOrder = (selected: Set<string>) => buildings.filter((building) => selected.has(building.id)).map((building) => building.id);

  const toggle = (buildingId: string) => {
    const selected = new Set(value);
    if (selected.has(buildingId)) {
      // Never leave the photo without a building: tapping the only one on does nothing.
      if (selected.size === 1) return;
      selected.delete(buildingId);
    } else selected.add(buildingId);
    onChange(inOrder(selected));
  };

  if (buildings.length > maxChoiceButtons) {
    return (
      <label className="form-field building-picker-field" htmlFor={id}>
        <span>{fieldLabel}</span>
        <select id={id} value={value[0] ?? ""} onChange={(event) => onChange([event.target.value])}>
          {buildings.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}
        </select>
      </label>
    );
  }

  return (
    <fieldset className="form-field building-choice-field" id={id}>
      <legend>{fieldLabel}</legend>
      <div className="building-choice-options">
        {buildings.map((building) => {
          const chosen = value.includes(building.id);
          return (
            <button
              className={chosen ? "active" : ""}
              type="button"
              aria-pressed={chosen}
              onClick={() => toggle(building.id)}
              key={building.id}
            >
              {chosen ? <Check size={14} /> : null}
              <span>{building.name}</span>
            </button>
          );
        })}
      </div>
      <small>{hint ?? text("The photo is filed under each selected building.", "De foto wordt onder elk gekozen gebouw vastgelegd.")}</small>
    </fieldset>
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
  return (
    <BuildingPicker id={id} buildings={buildings} value={value} onChange={onChange} label={label} hint={hint} multiple />
  );
}
