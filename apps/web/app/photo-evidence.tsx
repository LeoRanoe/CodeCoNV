"use client";

import { Camera, Compass, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { appendDictation, DictateButton } from "@/app/dictate-button";
import { appendPhotoDetail, MarkPhotoButton, PhotoMarkupPad, type PhotoMarkupContext } from "@/app/photo-markup";
import { useLanguage } from "@/lib/i18n";

/**
 * What the client's own product plan asks of every photo (§4.16): a category, a location, the
 * direction it was taken from and a description — next to the picture, not drawn on it. The
 * report needs the same three things per photo: time, location and an explanation.
 */
export type PhotoEvidenceDetails = {
  /** What is on the picture, in a few words. Becomes the file title in the report. */
  title: string;
  /** The explanation: what is visible, why it matters, what has to happen. */
  description: string;
  category: string;
  locationNodeId: string;
  /** The direction the camera was pointing, so a photo can be found back on site. */
  direction: string;
};

export type PhotoEvidence = {
  id: string;
  /** The photo as it will be filed: the marked copy once markings are saved. */
  file: File;
  /** The untouched original. §4.16: the original photo is always kept. */
  original: File;
  details: PhotoEvidenceDetails;
  markerCount: number;
};

export const photoCategories = [
  { id: "progress", en: "Progress", nl: "Voortgang" },
  { id: "deficiency", en: "Deficiency or deviation", nl: "Tekortkoming of afwijking" },
  { id: "safety", en: "Safety / HSE", nl: "Veiligheid / HSE" },
  { id: "delivery", en: "Delivery or material", nl: "Levering of materiaal" },
  { id: "measurement", en: "Test or measurement", nl: "Proef of meting" },
  { id: "repair", en: "After repair", nl: "Na herstel" },
  { id: "overview", en: "Overview or context", nl: "Overzicht of context" },
];

export const photoDirections = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const dutchDirections: Record<string, string> = { N: "N", NE: "NO", E: "O", SE: "ZO", S: "Z", SW: "ZW", W: "W", NW: "NW" };

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Wraps a freshly taken or chosen file so it can carry its own words from the first second. */
export function toPhotoEvidence(file: File, defaults: Partial<PhotoEvidenceDetails> = {}): PhotoEvidence {
  return {
    id: newId(),
    file,
    original: file,
    markerCount: 0,
    details: {
      title: "",
      description: "",
      category: "",
      locationNodeId: "",
      direction: "",
      ...defaults,
    },
  };
}

/** The photos that actually get filed, in the order they were taken. */
export function photoFiles(photos: PhotoEvidence[]) {
  return photos.map((photo) => photo.file);
}

/**
 * The written record of a photo, for the record it hangs under. Kept short on purpose: the
 * long story stays with the photo itself, where a reader of the report finds it back.
 */
export function photoEvidenceLine(photo: PhotoEvidence, language: "en" | "nl") {
  const category = photoCategories.find((entry) => entry.id === photo.details.category);
  return [
    photo.details.title.trim(),
    category ? (language === "en" ? category.en : category.nl) : "",
    photo.details.direction ? `${language === "en" ? "facing" : "kijkrichting"} ${language === "en" ? photo.details.direction : dutchDirections[photo.details.direction] ?? photo.details.direction}` : "",
  ].filter((part) => part.length > 0).join(" · ");
}

/**
 * The description a photo carries into the register: its own line and its own words, and only
 * the record's description when the supervisor wrote nothing with the photo itself.
 */
export function photoUploadDescription(photo: PhotoEvidence, fallback: string, language: "en" | "nl") {
  const own = [photoEvidenceLine(photo, language), photo.details.description.trim()].filter(Boolean).join("\n");
  return own || fallback.trim();
}

function PhotoThumbnail({ file, onOpen, label }: { file: File; onOpen: () => void; label: string }) {
  // The preview follows the file: marking a photo swaps it for the marked copy.
  const source = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(source), [source]);
  return (
    <button className="photo-evidence-thumb" type="button" onClick={onOpen} aria-label={label}>
      {/* A local blob URL cannot pass through the Next image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {source ? <img src={source} alt="" /> : <span className="photo-evidence-thumb-empty"><Camera size={18} /></span>}
    </button>
  );
}

/**
 * One block per attached photo, used by every screen that can attach one. The client asked for
 * a single way of working with photos instead of a different one per module, so this is the
 * only place the fields are defined.
 */
export function PhotoEvidenceList({
  photos,
  setPhotos,
  markupContext,
  compact = false,
}: {
  photos: PhotoEvidence[];
  setPhotos: (photos: PhotoEvidence[]) => void;
  markupContext?: PhotoMarkupContext;
  /** Leaves out the fields a very short form has no room for. */
  compact?: boolean;
}) {
  const { language, text } = useLanguage();
  const [markupId, setMarkupId] = useState("");
  const markupPhoto = photos.find((photo) => photo.id === markupId) ?? null;
  const locations = markupContext?.locations ?? [];

  const patch = (id: string, details: Partial<PhotoEvidenceDetails>) => setPhotos(photos.map((photo) =>
    photo.id === id ? { ...photo, details: { ...photo.details, ...details } } : photo));
  const remove = (id: string) => setPhotos(photos.filter((photo) => photo.id !== id));
  const restoreOriginal = (id: string) => setPhotos(photos.map((photo) =>
    photo.id === id ? { ...photo, file: photo.original, markerCount: 0 } : photo));

  if (!photos.length) return null;

  return (
    <div className="photo-evidence-list">
      {photos.map((photo, index) => {
        const photoLocations = locations.filter((location) => !location.buildingId
          || !markupContext?.defaultBuildingId
          || location.buildingId === markupContext.defaultBuildingId);
        return (
          <article className="photo-evidence-item" key={photo.id}>
            <div className="photo-evidence-visual">
              <PhotoThumbnail
                file={photo.file}
                onOpen={() => setMarkupId(photo.id)}
                label={text(`Mark on photo ${index + 1}`, `Markeer op foto ${index + 1}`)}
              />
              <MarkPhotoButton compact markerCount={photo.markerCount} onClick={() => setMarkupId(photo.id)} />
              {photo.file !== photo.original ? (
                <button className="photo-evidence-restore" type="button" onClick={() => restoreOriginal(photo.id)}>
                  <RotateCcw size={12} /> {text("Restore original", "Origineel herstellen")}
                </button>
              ) : null}
            </div>

            <div className="photo-evidence-fields">
              <span className="photo-evidence-number">{text(`Photo ${index + 1}`, `Foto ${index + 1}`)}</span>
              <label className="form-field">
                <span>{text("What is on this photo?", "Wat staat er op deze foto?")}</span>
                <input
                  value={photo.details.title}
                  onChange={(event) => patch(photo.id, { title: event.target.value })}
                  placeholder={text("For example: rebar column line B", "Bijvoorbeeld: wapening kolom lijn B")}
                />
              </label>
              <label className="form-field">
                <span>{text("Description · what is visible and why it matters", "Toelichting · wat is te zien en waarom is het belangrijk")}</span>
                <textarea
                  rows={2}
                  value={photo.details.description}
                  onChange={(event) => patch(photo.id, { description: event.target.value })}
                  placeholder={text("Describe it as you would to someone who was not there.", "Beschrijf het alsof je het uitlegt aan iemand die er niet bij was.")}
                />
                <DictateButton onText={(transcript) => patch(photo.id, { description: appendDictation(photo.details.description, transcript) })} />
              </label>
              {compact ? null : (
                <div className="form-grid-2">
                  <label className="form-field">
                    <span>{text("Category", "Categorie")}</span>
                    <select value={photo.details.category} onChange={(event) => patch(photo.id, { category: event.target.value })}>
                      <option value="">{text("Not specified", "Niet aangegeven")}</option>
                      {photoCategories.map((option) => <option value={option.id} key={option.id}>{language === "en" ? option.en : option.nl}</option>)}
                    </select>
                  </label>
                  {photoLocations.length ? (
                    <label className="form-field">
                      <span>{text("Exact location", "Exacte locatie")}</span>
                      <select value={photo.details.locationNodeId} onChange={(event) => patch(photo.id, { locationNodeId: event.target.value })}>
                        <option value="">{text("Same as the record", "Zelfde als de registratie")}</option>
                        {photoLocations.map((location) => <option value={location.id} key={location.id}>{location.label}</option>)}
                      </select>
                    </label>
                  ) : null}
                  <label className="form-field">
                    <span><Compass size={11} /> {text("Facing direction", "Kijkrichting")}</span>
                    <select value={photo.details.direction} onChange={(event) => patch(photo.id, { direction: event.target.value })}>
                      <option value="">{text("Not specified", "Niet aangegeven")}</option>
                      {photoDirections.map((option) => <option value={option} key={option}>{language === "en" ? option : dutchDirections[option]}</option>)}
                    </select>
                  </label>
                </div>
              )}
            </div>

            <button
              className="photo-evidence-remove"
              type="button"
              onClick={() => remove(photo.id)}
              aria-label={text(`Remove photo ${index + 1}`, `Verwijder foto ${index + 1}`)}
            ><X size={14} /></button>
          </article>
        );
      })}

      {markupPhoto ? (
        <PhotoMarkupPad
          file={markupPhoto.file}
          context={markupContext}
          close={() => setMarkupId("")}
          save={({ file, report, summary, markerCount }) => {
            setPhotos(photos.map((photo) => photo.id === markupPhoto.id
              ? {
                  ...photo,
                  // The original is never thrown away, so the untouched picture stays available.
                  file,
                  markerCount,
                  details: {
                    ...photo.details,
                    title: photo.details.title.trim() || summary,
                    // What the numbers on the picture mean belongs to the photo, next to it,
                    // instead of being printed over the picture itself.
                    description: appendPhotoDetail(photo.details.description, report),
                  },
                }
              : photo));
            setMarkupId("");
          }}
        />
      ) : null}
    </div>
  );
}
