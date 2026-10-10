/** Uniformly fit a stable drawing space inside a changing CSS viewport. */
export function strokeLayout(space, viewport) {
  if (![space.width, space.height, viewport.width, viewport.height].every((value) => Number.isFinite(value) && value > 0)) return null;
  const scale = Math.min(viewport.width / space.width, viewport.height / space.height);
  return { scale, x: (viewport.width - space.width * scale) / 2, y: (viewport.height - space.height * scale) / 2 };
}
export function strokePoint(clientX, clientY, bounds, space) {
  const layout = strokeLayout(space, bounds);
  if (!layout) return null;
  return {
    x: Math.max(0, Math.min(space.width, (clientX - bounds.left - layout.x) / layout.scale)),
    y: Math.max(0, Math.min(space.height, (clientY - bounds.top - layout.y) / layout.scale)),
  };
}
