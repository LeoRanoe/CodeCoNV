"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Crosshair, Loader2, LocateFixed, MapPin, Minus, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { validAccessToken } from "@/lib/supabase/access-token";

/**
 * Section 5 of the client's record screens: the spot itself, on the satellite view.
 *
 * The picture comes from this application's own map endpoint, which holds the provider
 * key. Tapping the picture moves the pin: the tap is a number of pixels from the centre,
 * and at a known zoom that is a known number of degrees, so the map can be read without
 * a single line of provider script — which the security policy of this application would
 * not allow anyway.
 *
 * Everything here is a convenience on top of the coordinates. Without a configured
 * provider, and on a site without a signal, the coordinates and the buttons stay; only
 * the picture is missing.
 */
export type RecordCoordinates = { latitude: string; longitude: string };

const mapWidth = 560;
const mapHeight = 240;

/** Web Mercator: the tile scheme every satellite view is drawn in. */
function coordinatesFromTap(center: { latitude: number; longitude: number }, zoom: number, offsetX: number, offsetY: number) {
  const worldSize = 256 * 2 ** zoom;
  const sinLatitude = Math.sin((center.latitude * Math.PI) / 180);
  const centerX = ((center.longitude + 180) / 360) * worldSize;
  const centerY = worldSize * (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI));
  const longitude = ((centerX + offsetX) / worldSize) * 360 - 180;
  const latitude = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (centerY + offsetY)) / worldSize))) * 180) / Math.PI;
  return { latitude, longitude };
}

export function RecordLocationMap({
  client,
  value,
  fallbackCenter,
  contextLabel,
  onChange,
  onUseMyLocation,
  locating = false,
  manualOpen,
  onToggleManual,
}: {
  /** The signed-in session: every picture costs the project money at the provider. */
  client: SupabaseClient;
  value: RecordCoordinates;
  /** Where to look when nothing has been recorded yet: the project's own place. */
  fallbackCenter?: { latitude: number; longitude: number } | null;
  contextLabel: string;
  onChange: (coordinates: RecordCoordinates) => void;
  onUseMyLocation: () => void;
  locating?: boolean;
  manualOpen: boolean;
  onToggleManual: () => void;
}) {
  const { text } = useLanguage();
  const [zoom, setZoom] = useState(17);
  /** The picture itself, held on the device: the request that fetched it was signed. */
  const [mapImage, setMapImage] = useState<{ source: string; url: string } | null>(null);

  const recorded = value.latitude.trim() !== "" && value.longitude.trim() !== ""
    ? { latitude: Number(value.latitude), longitude: Number(value.longitude) }
    : null;
  const center = recorded && Number.isFinite(recorded.latitude) && Number.isFinite(recorded.longitude)
    ? recorded
    : fallbackCenter ?? null;

  const mapSource = center
    ? `/api/maps/static?latitude=${center.latitude.toFixed(6)}&longitude=${center.longitude.toFixed(6)}&zoom=${zoom}&width=${mapWidth}&height=${mapHeight}`
    : "";

  // The satellite view is fetched the way every other protected picture in this app is
  // fetched: with the session token, and shown from the device's own memory afterwards.
  // A site without a signal, or a project without a configured provider, simply keeps the
  // coordinates; the map is never the record.
  useEffect(() => {
    if (!mapSource) return;
    let cancelled = false;
    let objectUrl = "";
    void (async () => {
      try {
        const token = await validAccessToken(client);
        const response = await fetch(mapSource, { headers: { authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setMapImage({ source: mapSource, url: objectUrl });
      } catch {
        if (!cancelled) setMapImage(null);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [client, mapSource]);

  const moveTo = (event: React.MouseEvent<HTMLImageElement>) => {
    if (!center) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    // The picture is drawn at the width it happens to have on this screen; the map itself
    // was asked for in its own pixels, so the tap is converted back to those first.
    const scaleX = mapWidth / bounds.width;
    const scaleY = mapHeight / bounds.height;
    const offsetX = (event.clientX - bounds.left - bounds.width / 2) * scaleX;
    const offsetY = (event.clientY - bounds.top - bounds.height / 2) * scaleY;
    const moved = coordinatesFromTap(center, zoom, offsetX, offsetY);
    onChange({ latitude: moved.latitude.toFixed(6), longitude: moved.longitude.toFixed(6) });
  };

  return (
    <div className="record-location-block">
      {center && mapImage?.source === mapSource ? (
        <div className="record-location-map">
          {/* A satellite tile is not an image of this project; the optimizer would only
              re-encode a picture that is already the size it is shown at. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mapImage.url}
            alt={text("Satellite view of the recorded spot", "Satellietbeeld van de vastgelegde plek")}
            onClick={moveTo}
            width={mapWidth}
            height={mapHeight}
          />
          <div className="record-location-zoom">
            <button type="button" onClick={() => setZoom((current) => Math.min(20, current + 1))} aria-label={text("Zoom in", "Inzoomen")}><Plus size={14} /></button>
            <button type="button" onClick={() => setZoom((current) => Math.max(3, current - 1))} aria-label={text("Zoom out", "Uitzoomen")}><Minus size={14} /></button>
          </div>
          <p className="record-location-tip"><Crosshair size={12} /> {text("Tap the map to move the pin", "Tik op de kaart om de speld te verplaatsen")}</p>
        </div>
      ) : null}
      <div className="record-location-card">
        <div className="record-location-readout">
          <MapPin size={16} />
          <div>
            <strong>{recorded ? `Lat: ${value.latitude}, Long: ${value.longitude}` : text("No coordinates recorded yet", "Nog geen coördinaten vastgelegd")}</strong>
            <span>{contextLabel}</span>
          </div>
        </div>
        <div className="record-location-buttons">
          <button className="ghost-button" type="button" disabled={locating} onClick={onUseMyLocation}>
            {locating ? <Loader2 className="spin" size={14} /> : <LocateFixed size={14} />} {recorded ? text("Change location", "Locatie wijzigen") : text("Use my location", "Gebruik mijn locatie")}
          </button>
          <button className="ghost-button" type="button" aria-pressed={manualOpen} onClick={onToggleManual}><Pencil size={14} /> {text("Type coordinates", "Coördinaten invullen")}</button>
        </div>
      </div>
      {manualOpen ? (
        <div className="form-grid-2">
          <label className="form-field"><span>{text("Latitude", "Breedtegraad")}</span><input inputMode="decimal" value={value.latitude} onChange={(event) => onChange({ ...value, latitude: event.target.value })} placeholder="5.8521" /></label>
          <label className="form-field"><span>{text("Longitude", "Lengtegraad")}</span><input inputMode="decimal" value={value.longitude} onChange={(event) => onChange({ ...value, longitude: event.target.value })} placeholder="-55.2034" /></label>
        </div>
      ) : null}
    </div>
  );
}
