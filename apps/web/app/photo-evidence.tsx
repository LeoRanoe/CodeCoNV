"use client";

import { Check, ChevronRight, Compass, MapPin, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { appendDictation, DictateButton } from "@/app/dictate-button";
import { appendPhotoDetail, MarkPhotoButton, PhotoMarkupPad, type MarkupOption, type PhotoMarkupContext } from "@/app/photo-markup";
import { useLanguage } from "@/lib/i18n";
import { useBackToClose } from "@/lib/navigation/app-history";

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
  /** Empty means "the same building as the record this photo hangs under". */
  buildingId: string;
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
export const dutchDirectionLabels: Record<string, string> = { N: "N", NE: "NO", E: "O", SE: "ZO", S: "Z", SW: "ZW", W: "W", NW: "NW" };
const dutchDirections = dutchDirectionLabels;

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
      buildingId: "",
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

function PhotoThumbnail({ file, large }: { file: File; large?: boolean }) {
  // The preview follows the file: marking a photo swaps it for the marked copy.
  const source = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(source), [source]);
  // A local blob URL cannot pass through the Next image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={large ? "photo-detail-image" : "photo-evidence-thumb"} src={source} alt="" />;
}

/**
 * The short line under a photo in a form: enough to see at a glance whether this picture has
 * been described, without unrolling every field into the record itself.
 */
function photoSummaryLine(photo: PhotoEvidence, language: "en" | "nl", options: MarkupOption[]) {
  const category = photoCategories.find((entry) => entry.id === photo.details.category);
  return [
    category ? (language === "en" ? category.en : category.nl) : "",
    options.find((option) => option.id === photo.details.locationNodeId)?.label ?? "",
    photo.details.direction ? `${language === "en" ? "facing" : "kijkrichting"} ${language === "en" ? photo.details.direction : dutchDirections[photo.details.direction] ?? photo.details.direction}` : "",
  ].filter((part) => part.length > 0).join(" · ");
}

/**
 * One row per attached photo, used by every screen that can attach one. The row stays small on
 * purpose: the client did not want a record form that turns into a page of photo fields. The
 * picture itself is the way in — tapping it opens everything that belongs to that photo.
 */
export function PhotoEvidenceList({
  photos,
  setPhotos,
  markupContext,
}: {
  photos: PhotoEvidence[];
  setPhotos: (photos: PhotoEvidence[]) => void;
  markupContext?: PhotoMarkupContext;
}) {
  const { language, text } = useLanguage();
  const [openId, setOpenId] = useState("");
  const openPhoto = photos.find((photo) => photo.id === openId) ?? null;
  const locations = markupContext?.locations ?? [];

  const remove = (id: string) => setPhotos(photos.filter((photo) => photo.id !== id));

  if (!photos.length) return null;

  return (
    <div className="photo-evidence-list">
      {photos.map((photo, index) => {
        const line = photoSummaryLine(photo, language, locations);
        return (
          <article className="photo-evidence-row" key={photo.id}>
            <button
              className="photo-evidence-open"
              type="button"
              onClick={() => setOpenId(photo.id)}
              aria-label={text(`Open the details of photo ${index + 1}`, `Open de details van foto ${index + 1}`)}
            >
              <PhotoThumbnail file={photo.file} />
              <span className="photo-evidence-row-text">
                <strong>{photo.details.title.trim() || text(`Photo ${index + 1} · not described yet`, `Foto ${index + 1} · nog niet omschreven`)}</strong>
                <small>{line || text("Tap to add the description and details", "Tik om de omschrijving en details toe te voegen")}</small>
                {photo.markerCount ? <em><MapPin size={11} /> {text(`${photo.markerCount} marked`, `${photo.markerCount} gemarkeerd`)}</em> : null}
              </span>
              <ChevronRight size={18} />
            </button>
            <button
              className="photo-evidence-remove"
              type="button"
              onClick={() => remove(photo.id)}
              aria-label={text(`Remove photo ${index + 1}`, `Verwijder foto ${index + 1}`)}
            ><X size={14} /></button>
          </article>
        );
      })}

      {openPhoto ? (
        <PhotoDetailSheet
          photo={openPhoto}
          index={photos.findIndex((photo) => photo.id === openPhoto.id)}
          markupContext={markupContext}
          close={() => setOpenId("")}
          onChange={(next) => setPhotos(photos.map((photo) => photo.id === next.id ? next : photo))}
          onRemove={() => { remove(openPhoto.id); setOpenId(""); }}
        />
      ) : null}
    </div>
  );
}

/**
 * Everything that belongs to one photo, on its own screen: the picture, the way into marking
 * it, and the words, category, place and direction that travel with it into the register.
 */
export function PhotoDetailSheet({
  photo,
  index,
  markupContext,
  close,
  onChange,
  onRemove,
}: {
  photo: PhotoEvidence;
  index: number;
  markupContext?: PhotoMarkupContext;
  close: () => void;
  onChange: (photo: PhotoEvidence) => void;
  onRemove?: () => void;
}) {
  const { language, text } = useLanguage();
  const [marking, setMarking] = useState(false);
  // On a phone this is a page of its own: the back gesture closes it instead of
  // leaving the record behind it. The entry stays while the marking pad is open on
  // top, so back closes the pad first and this sheet after it.
  useBackToClose(true, close);
  const buildings = markupContext?.buildings ?? [];
  const chosenBuildingId = photo.details.buildingId || markupContext?.defaultBuildingId || "";
  const locations = (markupContext?.locations ?? []).filter((location) =>
    !location.buildingId || !chosenBuildingId || location.buildingId === chosenBuildingId);

  const patch = (details: Partial<PhotoEvidenceDetails>) => onChange({ ...photo, details: { ...photo.details, ...details } });

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal photo-detail-modal" role="dialog" aria-modal="true" aria-labelledby="photo-detail-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">{text(`Photo ${index + 1}`, `Foto ${index + 1}`)}</p>
            <h2 id="photo-detail-title">{text("Photo details", "Fotodetails")}</h2>
            <p>{text("Time, author, project and building are recorded automatically. Everything you add here travels with the photo.", "Tijd, maker, project en gebouw worden automatisch vastgelegd. Alles wat je hier toevoegt reist met de foto mee.")}</p>
          </div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>

        <div className="modal-body photo-detail-body">
          <div className="photo-detail-visual">
            <PhotoThumbnail file={photo.file} large />
            <div className="photo-detail-visual-actions">
              <MarkPhotoButton markerCount={photo.markerCount} onClick={() => setMarking(true)} />
              {photo.file !== photo.original ? (
                <button className="photo-evidence-restore" type="button" onClick={() => onChange({ ...photo, file: photo.original, markerCount: 0 })}>
                  <RotateCcw size={12} /> {text("Restore original", "Origineel herstellen")}
                </button>
              ) : null}
            </div>
          </div>

          <label className="form-field">
            <span>{text("What is on this photo?", "Wat staat er op deze foto?")}</span>
            <input
              value={photo.details.title}
              onChange={(event) => patch({ title: event.target.value })}
              placeholder={text("For example: rebar column line B", "Bijvoorbeeld: wapening kolom lijn B")}
              autoFocus
            />
          </label>
          <label className="form-field">
            <span>{text("Description · what is visible and why it matters", "Toelichting · wat is te zien en waarom is het belangrijk")}</span>
            <textarea
              rows={3}
              value={photo.details.description}
              onChange={(event) => patch({ description: event.target.value })}
              placeholder={text("Describe it as you would to someone who was not there.", "Beschrijf het alsof je het uitlegt aan iemand die er niet bij was.")}
            />
            <DictateButton onText={(transcript) => patch({ description: appendDictation(photo.details.description, transcript) })} />
          </label>
          <div className="form-grid-2">
            <label className="form-field">
              <span>{text("Category", "Categorie")}</span>
              <select value={photo.details.category} onChange={(event) => patch({ category: event.target.value })}>
                <option value="">{text("Not specified", "Niet aangegeven")}</option>
                {photoCategories.map((option) => <option value={option.id} key={option.id}>{language === "en" ? option.en : option.nl}</option>)}
              </select>
            </label>
            {buildings.length > 1 ? (
              <label className="form-field">
                <span>{text("Building", "Gebouw")}</span>
                <select value={photo.details.buildingId} onChange={(event) => patch({ buildingId: event.target.value, locationNodeId: "" })}>
                  <option value="">{text("Same as the record", "Zelfde als de registratie")}</option>
                  {buildings.map((building) => <option value={building.id} key={building.id}>{building.label}</option>)}
                </select>
              </label>
            ) : null}
            {locations.length ? (
              <label className="form-field">
                <span>{text("Exact location", "Exacte locatie")}</span>
                <select value={photo.details.locationNodeId} onChange={(event) => patch({ locationNodeId: event.target.value })}>
                  <option value="">{text("Same as the record", "Zelfde als de registratie")}</option>
                  {locations.map((location) => <option value={location.id} key={location.id}>{location.label}</option>)}
                </select>
              </label>
            ) : null}
            <label className="form-field">
              <span><Compass size={11} /> {text("Facing direction", "Kijkrichting")}</span>
              <select value={photo.details.direction} onChange={(event) => patch({ direction: event.target.value })}>
                <option value="">{text("Not specified", "Niet aangegeven")}</option>
                {photoDirections.map((option) => <option value={option} key={option}>{language === "en" ? option : dutchDirections[option]}</option>)}
              </select>
            </label>
          </div>
        </div>

        <footer className="modal-actions">
          {onRemove
            ? <button className="secondary-button photo-detail-remove" type="button" onClick={onRemove}><Trash2 size={15} /> {text("Remove photo", "Foto verwijderen")}</button>
            : <span />}
          <button className="primary-button" type="button" onClick={close}><Check size={15} /> {text("Done", "Klaar")}</button>
        </footer>

        {marking ? (
          <PhotoMarkupPad
            file={photo.file}
            context={markupContext}
            close={() => setMarking(false)}
            save={({ file, report, summary, markerCount }) => {
              onChange({
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
              });
              setMarking(false);
            }}
          />
        ) : null}
      </section>
    </div>
  );
}
