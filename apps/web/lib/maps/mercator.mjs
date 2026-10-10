// Provider map pixels are independent of CSS size and device pixel ratio.
export const mercatorLatitudeLimit = 85.0511287798066;

export function validMapCoordinates(center) {
  return Boolean(center && Number.isFinite(center.latitude) && Number.isFinite(center.longitude)
    && Math.abs(center.latitude) <= mercatorLatitudeLimit && Math.abs(center.longitude) <= 180);
}

export function coordinatesFromTap(center, zoom, offsetX, offsetY) {
  if (!validMapCoordinates(center) || !Number.isInteger(zoom) || zoom < 3 || zoom > 20
    || !Number.isFinite(offsetX) || !Number.isFinite(offsetY)) return null;
  const worldSize = 256 * 2 ** zoom;
  const sinLatitude = Math.sin(center.latitude * Math.PI / 180);
  const centerX = (center.longitude + 180) / 360 * worldSize;
  const centerY = worldSize * (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI));
  const y = Math.min(worldSize, Math.max(0, centerY + offsetY));
  const longitude = ((centerX + offsetX) / worldSize * 360) % 360;
  return {
    latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * y / worldSize))) * 180 / Math.PI,
    longitude: ((longitude + 360) % 360) - 180,
  };
}
