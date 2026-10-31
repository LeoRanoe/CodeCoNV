/**
 * The rules behind the back button, kept free of React so they can be tested on their
 * own. A screen is what a user would call a page: the project, the destination in the
 * bar, the open module and any full-screen dialog.
 *
 * @typedef {{ project: string | null, nav: string, tab: string, modal: string | null, menu: boolean }} AppScreen
 */

/** @type {AppScreen} */
export const emptyScreen = { project: null, nav: "vandaag", tab: "home", modal: null, menu: false };

export function sameScreen(left, right) {
  return left.project === right.project
    && left.nav === right.nav
    && left.tab === right.tab
    && left.modal === right.modal
    && left.menu === right.menu;
}

/** Only an overlay is closing; everything underneath stays where it was. */
export function closesOverlay(from, to) {
  const overlayGone = (Boolean(from.modal) && !to.modal) || (from.menu && !to.menu);
  return overlayGone && from.project === to.project && from.nav === to.nav && from.tab === to.tab;
}

export function screenToSearch(screen) {
  const query = new URLSearchParams();
  if (screen.project) query.set("project", screen.project);
  if (screen.nav !== emptyScreen.nav) query.set("nav", screen.nav);
  if (screen.tab !== emptyScreen.tab) query.set("tab", screen.tab);
  if (screen.modal) query.set("modal", screen.modal);
  const search = query.toString();
  return search ? `?${search}` : "";
}

/** Destinations that are the workspace with one module open (LQA-012). */
const destinationTabs = { punchlist: "findings", projectdocs: "documents" };

export function screenFromSearch(search) {
  const query = new URLSearchParams(search);
  const nav = query.get("nav") ?? emptyScreen.nav;
  return {
    project: query.get("project"),
    nav,
    // A link to Issues or Project Docs without a module opens that module, not the workspace grid.
    tab: query.get("tab") ?? destinationTabs[nav] ?? emptyScreen.tab,
    modal: query.get("modal"),
    // A drawer is never restored from a link; it is only ever opened by hand.
    menu: false,
  };
}

/**
 * What the history should do when the app moves from one screen to the next.
 *
 * - "none": nothing changed;
 * - "replace": the first screen, and every screen the back button just restored;
 * - "back": a dialog closed by hand, so the entry it added is spent instead of stacked;
 * - "push": a new screen, which is what the back button will return to.
 *
 * @param {AppScreen | null} previous
 * @param {AppScreen} next
 * @param {boolean} restoring
 */
export function historyActionFor(previous, next, restoring) {
  if (!previous) return "replace";
  if (sameScreen(previous, next)) return "none";
  if (restoring) return "replace";
  if (closesOverlay(previous, next)) return "back";
  return "push";
}
