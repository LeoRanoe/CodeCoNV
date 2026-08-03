import { compassPointFromDegrees } from "@/lib/images/field-image.mjs";

/**
 * The live compass of the device, kept ready for the moment a photo is taken.
 *
 * Most site photos carry their own bearing in EXIF, but a phone that had no satellite fix
 * indoors writes nothing. The compass in the device still knows which way it was held, so the
 * last reading before the shutter is used instead. Listening starts on the tap that opens the
 * camera: iOS only hands out orientation after a gesture, and a sensor that runs all day for
 * nothing is a battery cost a field app cannot justify.
 */

type OrientationEventWithCompass = DeviceOrientationEvent & { webkitCompassHeading?: number };
type PermissionCapableEvent = { requestPermission?: () => Promise<"granted" | "denied" | "default"> };

let heading: number | null = null;
let watching = false;

function handleOrientation(event: Event) {
  const orientation = event as OrientationEventWithCompass;
  // iOS reports a true compass heading directly; elsewhere alpha is the heading counted the
  // other way round, and is only a bearing when the reading is absolute.
  if (typeof orientation.webkitCompassHeading === "number" && Number.isFinite(orientation.webkitCompassHeading)) {
    heading = orientation.webkitCompassHeading;
    return;
  }
  if (orientation.absolute && typeof orientation.alpha === "number" && Number.isFinite(orientation.alpha)) {
    heading = (360 - orientation.alpha) % 360;
  }
}

/** Starts the compass on a user gesture. Safe to call again; a second call changes nothing. */
export async function startCompassWatch() {
  if (watching || typeof window === "undefined" || typeof window.addEventListener !== "function") return;
  watching = true;
  const permission = (window.DeviceOrientationEvent ?? {}) as unknown as PermissionCapableEvent;
  if (typeof permission.requestPermission === "function") {
    try {
      const granted = await permission.requestPermission();
      if (granted !== "granted") {
        watching = false;
        return;
      }
    } catch {
      // A device that refuses the sensor simply leaves the direction to be chosen by hand.
      watching = false;
      return;
    }
  }
  window.addEventListener("deviceorientationabsolute", handleOrientation, true);
  window.addEventListener("deviceorientation", handleOrientation, true);
}

export function stopCompassWatch() {
  if (!watching || typeof window === "undefined") return;
  watching = false;
  window.removeEventListener("deviceorientationabsolute", handleOrientation, true);
  window.removeEventListener("deviceorientation", handleOrientation, true);
}

/** The last bearing the device reported, as one of the eight points, or "" when it has none. */
export function currentCompassPoint() {
  return compassPointFromDegrees(heading);
}

/** Only for tests: the module keeps one reading, so it has to be clearable. */
export function setCompassHeadingForTest(value: number | null) {
  heading = value;
}
