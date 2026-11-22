/** Delivery links identify a notification. The signed-in app resolves it under the recipient's permissions. */
export function notificationPath(projectId, notificationId) {
  return `/supervisie?${new URLSearchParams({ project: projectId, notification: notificationId })}`;
}

export function notificationRecordScreen(project, sourceType, record, portal = false) {
  const tabs = { finding: "findings", inspection: "inspections", hse: "hse", register_entry: "registers", project_document: "documents", file: "files" };
  const tab = Object.hasOwn(tabs, sourceType ?? "") ? tabs[sourceType] : "home";
  const nav = sourceType === "portal_share" && !portal ? "meer"
    : sourceType === "action" ? "acties"
    : sourceType === "report" ? "rapporten"
    : portal ? "vandaag" : "project";
  return { project, nav, tab, record, modal: null, menu: false };
}
