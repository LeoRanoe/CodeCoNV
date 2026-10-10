export function locationPath(nodes, id, buildingId, activeOnly = false) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const path = [];
  const seen = new Set();
  let current = byId.get(id);
  if (!current) return [];
  const building = buildingId ?? current.building_id;
  while (current) {
    if (seen.has(current.id) || current.building_id !== building || (activeOnly && current.status !== "active")) return [];
    seen.add(current.id);
    path.unshift(current);
    if (!current.parent_id) return path;
    current = byId.get(current.parent_id);
    if (!current) return [];
  }
  return [];
}

export function locationBreadcrumb(nodes, id) {
  return locationPath(nodes, id).map((node) => `${node.code} · ${node.name}`).join(" → ");
}

export function selectableLocation(nodes, id, buildingId, requiredDepth = "building") {
  const path = locationPath(nodes, id, buildingId, true);
  const depth = { building: 0, floor: 1, room: 2, element: 3 };
  return path.length > 0 && (depth[path.at(-1).node_type] ?? -1) >= (depth[requiredDepth] ?? 0);
}
