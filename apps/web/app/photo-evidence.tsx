"use client";

import { Camera, Check, ChevronRight, MapPin, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { appendDictation, DictateButton } from "@/app/dictate-button";
import { appendPhotoDetail, MarkPhotoButton, PhotoMarkupPad, type MarkupOption, type PhotoMarkupContext } from "@/app/photo-markup";
import { useLanguage } from "@/lib/i18n";
import { compassPointFromDegrees, photoTitleFromDescription } from "@/lib/images/field-image.mjs";
import { readPhotoDirection } from "@/lib/images/exif-direction.mjs";
import { useBackToClose } from "@/lib/navigation/app-history";

/**
 * What the client's own product plan asks of every photo (§4.16): a location, the direction it
 * was taken from and a description — next to the picture, not drawn on it. The report needs
 * time, location and an explanation per photo.
 *
 * Since the feedback of 2 August it is one written field, not three: the supervisor writes what
 * is on the picture and why it matters, and the app fills in the rest.
 */
export type PhotoEvidenceDetails = {
  /**
   * The name of the file in the report. Filled in from the first sentence of the description;
   * kept as its own field because a marking on the photo can also name the picture.
   */
  title: string;
  /** The explanation: what is visible, why it matters, what has to happen. */
  description: string;
  category: string;
  /** Empty means "the same building as the record this photo hangs under". */
  buildingId: string;
  locationNodeId: string;
  /** The direction the camera was pointing, so a photo can be found back on site. */
  direction: string;
  /** True while the direction is the one the camera or the compass measured. */
  directionAutomatic?: boolean;
};

/**
 * The name this photo carries into the register. The supervisor no longer types a title, so
 * the first sentence of the description is used unless a marking already named the picture.
 */
export function photoTitle(photo: PhotoEvidence) {
  return photo.details.title.trim() || photoTitleFromDescription(photo.details.description);
}

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
  const written = photo.details.description.trim();
  const title = photo.details.title.trim();
  return [
    // The title normally is the opening of the description, and printing the same sentence
    // twice above itself is what a report reader notices first.
    title && !written.startsWith(title) ? title : "",
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
  layout = "list",
  allowMarkup = true,
}: {
  photos: PhotoEvidence[];
  setPhotos: (photos: PhotoEvidence[]) => void;
  markupContext?: PhotoMarkupContext;
  /**
   * "gallery" is the strip of thumbnails the client drew on their record screens: the
   * picture with a cross on it, next to the tile that adds one. It is the same block —
   * the same detail screen, the same marking pad — shown as a strip instead of a list.
   */
  layout?: "list" | "gallery";
  /** Photos/Assets are filing surfaces; marking stays in record evidence and Visual Evidence. */
  allowMarkup?: boolean;
}) {
  const { language, text } = useLanguage();
  const [openId, setOpenId] = useState("");
  const openPhoto = photos.find((photo) => photo.id === openId) ?? null;
  const locations = markupContext?.locations ?? [];

  const remove = (id: string) => setPhotos(photos.filter((photo) => photo.id !== id));

  if (!photos.length) return null;

  if (layout === "gallery") {
    return (
      <div className="photo-evidence-gallery">
        {photos.map((photo, index) => (
          <article className="photo-evidence-tile" key={photo.id}>
            <button
              className="photo-evidence-tile-open"
              type="button"
              onClick={() => setOpenId(photo.id)}
              aria-label={text(`Open the details of photo ${index + 1}`, `Open de details van foto ${index + 1}`)}
            >
              <PhotoThumbnail file={photo.file} />
              {photoTitle(photo) ? null : <span className="photo-evidence-tile-todo">{text("Describe", "Omschrijf")}</span>}
              {photo.markerCount ? <em><MapPin size={11} /> {photo.markerCount}</em> : null}
            </button>
            <button
              className="photo-evidence-tile-remove"
              type="button"
              onClick={() => remove(photo.id)}
              aria-label={text(`Remove photo ${index + 1}`, `Verwijder foto ${index + 1}`)}
            ><X size={13} /></button>
          </article>
        ))}
        {openPhoto ? (
          <PhotoDetailSheet
            photo={openPhoto}
            index={photos.findIndex((photo) => photo.id === openPhoto.id)}
            markupContext={markupContext}
            allowMarkup={allowMarkup}
            close={() => setOpenId("")}
            onChange={(next) => setPhotos(photos.map((photo) => photo.id === next.id ? next : photo))}
            onRemove={() => { remove(openPhoto.id); setOpenId(""); }}
          />
        ) : null}
      </div>
    );
  }

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
                <strong>{photoTitle(photo) || text(`Photo ${index + 1} · not described yet`, `Foto ${index + 1} · nog niet omschreven`)}</strong>
                <small>{line || text("Tap to write what is on this photo", "Tik om te schrijven wat er op deze foto staat")}</small>
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
          allowMarkup={allowMarkup}
          close={() => setOpenId("")}
          onChange={(next) => setPhotos(photos.map((photo) => photo.id === next.id ? next : photo))}
          onRemove={() => { remove(openPhoto.id); setOpenId(""); }}
        />
      ) : null}
    </div>
  );
}

/** What a field form accepts as a photo. */
export const photoMimeTypes = ["image/jpeg", "image/png", "image/webp"];

/**
 * A photo the form asks for by name and by position: "Picture of Issue", "Picture of
 * Result", "Actual Photo on Original Finish Date", "Photo as Evidence". On the client's
 * own forms these are their own box, marked required, standing next to the field they
 * prove — not one more picture in the pile at the bottom of the form. A pile cannot say
 * which photo is the before and which is the after; a named slot can.
 *
 * Everything else about a photo stays the same: tapping the picture opens the one detail
 * screen, with the same words, category, place, direction and marking pad.
 */
export function NamedPhotoSlot({
  label,
  hint,
  required = false,
  value,
  onChange,
  markupContext,
  maxSizeMb = 25,
  defaults,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  value: PhotoEvidence | null;
  onChange: (photo: PhotoEvidence | null) => void;
  markupContext?: PhotoMarkupContext;
  maxSizeMb?: number;
  /** What this photo already knows before a word is written: its category, its building. */
  defaults?: Partial<PhotoEvidenceDetails>;
}) {
  const { text } = useLanguage();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!photoMimeTypes.includes(file.type) || file.size > maxSizeMb * 1024 * 1024) {
      setError(text(
        `Use a JPEG, PNG or WebP file up to ${maxSizeMb} MB.`,
        `Gebruik een JPEG-, PNG- of WebP-bestand tot ${maxSizeMb} MB.`,
      ));
      return;
    }
    setError("");
    onChange(toPhotoEvidence(file, defaults));
  };

  return (
    <div className={`named-photo-slot${value ? " filled" : ""}`}>
      <span className="named-photo-slot-label">{label}{required ? <em aria-hidden="true"> *</em> : null}</span>
      {value ? (
        <div className="named-photo-slot-filled">
          <button
            className="named-photo-slot-preview"
            type="button"
            onClick={() => setOpen(true)}
            aria-label={text(`Open the details of the photo for ${label}`, `Open de details van de foto voor ${label}`)}
          >
            <PhotoThumbnail file={value.file} />
            <span className="named-photo-slot-text">
              <strong>{photoTitle(value) || text("Tap to write what is on this photo", "Tik om te schrijven wat er op deze foto staat")}</strong>
              {value.markerCount ? <em><MapPin size={11} /> {text(`${value.markerCount} marked`, `${value.markerCount} gemarkeerd`)}</em> : null}
            </span>
            <ChevronRight size={17} />
          </button>
          <button
            className="named-photo-slot-remove"
            type="button"
            onClick={() => onChange(null)}
            aria-label={text(`Remove the photo for ${label}`, `Verwijder de foto voor ${label}`)}
          ><X size={13} /></button>
        </div>
      ) : (
        <label className="named-photo-slot-capture">
          <Camera size={21} />
          <span>
            <strong>{text("Tap to capture photo", "Tik om een foto te maken")}</strong>
            <small>{hint ?? text("or choose from gallery", "of kies uit de galerij")}</small>
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={(event) => { pick(event.currentTarget.files); event.currentTarget.value = ""; }}
          />
        </label>
      )}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {open && value ? (
        <PhotoDetailSheet
          photo={value}
          index={0}
          markupContext={markupContext}
          close={() => setOpen(false)}
          onChange={onChange}
          onRemove={() => { onChange(null); setOpen(false); }}
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
  allowMarkup = true,
}: {
  photo: PhotoEvidence;
  index: number;
  markupContext?: PhotoMarkupContext;
  close: () => void;
  onChange: (photo: PhotoEvidence) => void;
  onRemove?: () => void;
  allowMarkup?: boolean;
}) {
  const { text } = useLanguage();
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

  // "Kan dit automatisch?" — the camera writes its own bearing into the original picture, so
  // the direction is read there once, and only while nobody has answered it by hand.
  const measured = photo.details.direction;
  const original = photo.original;
  useEffect(() => {
    if (measured) return;
    let active = true;
    void readPhotoDirection(original).then((degrees) => {
      const point = compassPointFromDegrees(degrees);
      if (active && point) patch({ direction: point, directionAutomatic: true });
    });
    return () => { active = false; };
    // The reading depends on the picture alone; patch closes over the photo it belongs to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measured, original]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal photo-detail-modal" role="dialog" aria-modal="true" aria-labelledby="photo-detail-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">{text(`Photo ${index + 1}`, `Foto ${index + 1}`)}</p>
            <h2 id="photo-detail-title">{text("Photo details", "Fotodetails")}</h2>
          </div>
          <button className="modal-close" type="button" onClick={close} aria-label={text("Close", "Sluiten")}><X size={18} /></button>
        </header>

        <div className="modal-body photo-detail-body">
          <div className="photo-detail-visual">
            <PhotoThumbnail file={photo.file} large />
            <div className="photo-detail-visual-actions">
              {allowMarkup ? <MarkPhotoButton markerCount={photo.markerCount} onClick={() => setMarking(true)} /> : null}
              {allowMarkup && photo.file !== photo.original ? (
                <button className="photo-evidence-restore" type="button" onClick={() => onChange({ ...photo, file: photo.original, markerCount: 0 })}>
                  <RotateCcw size={12} /> {text("Restore original", "Origineel herstellen")}
                </button>
              ) : null}
            </div>
          </div>

          {/* One text box. The client struck through the separate title and the category:
              "voor nr is 1 invoer voldoende". The report title is taken from the first
              sentence of what is written here. */}
          <label className="form-field">
            <span>{text("Description", "Omschrijving")}</span>
            <textarea
              rows={4}
              value={photo.details.description}
              onChange={(event) => patch({ description: event.target.value })}
              autoFocus
            />
            <DictateButton onText={(transcript) => patch({ description: appendDictation(photo.details.description, transcript) })} />
          </label>
          <div className="form-grid-2">
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
          </div>
        </div>

        <footer className="modal-actions">
          {onRemove
            ? <button className="ui-button ui-button--secondary ui-button--md secondary-button photo-detail-remove" type="button" onClick={onRemove}><Trash2 size={15} /> {text("Remove photo", "Foto verwijderen")}</button>
            : <span />}
          <button className="ui-button ui-button--primary ui-button--md primary-button" type="button" onClick={close}><Check size={15} /> {text("Done", "Klaar")}</button>
        </footer>

        {allowMarkup && marking ? (
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
