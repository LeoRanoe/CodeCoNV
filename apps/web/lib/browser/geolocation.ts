import { validMapCoordinates } from "@/lib/maps/mercator.mjs";

export function locateCoordinates(signal: AbortSignal): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Cancelled", "AbortError")); return; }
    if (!navigator.geolocation) { reject(new Error("Location unavailable. Enter the coordinates.")); return; }
    let finished = false;
    const finish = (coordinates?: { latitude: number; longitude: number }, error?: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (error) reject(error); else resolve(coordinates!);
    };
    const abort = () => finish(undefined, new DOMException("Cancelled", "AbortError"));
    const timer = setTimeout(() => finish(undefined, new Error("Location timed out. Enter the coordinates.")), 16_000);
    signal.addEventListener("abort", abort, { once: true });
    try {
      navigator.geolocation.getCurrentPosition((position) => {
        const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        if (!validMapCoordinates(coordinates)) finish(undefined, new Error("Location coordinates were invalid. Enter them manually."));
        else finish(coordinates);
      }, () => finish(undefined, new Error("Location could not be read. Enter the coordinates.")),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 });
    } catch (error) { finish(undefined, error); }
  });
}
