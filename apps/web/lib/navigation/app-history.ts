"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  historyActionFor,
  screenToSearch,
} from "@/lib/navigation/screen-url.mjs";

/**
 * The whole supervision app lives on one route and switches screens with state. On a
 * phone that is a problem: the hardware back button leaves the app instead of going one
 * screen back. Every screen the user perceives as a page therefore becomes a history
 * entry, described by this object and mirrored in the address bar.
 */
export type AppScreen = {
  /** The project that is open; null is the project-selection screen. */
  project: string | null;
  /** The destination of the bottom bar. */
  nav: string;
  /** The workspace module, only meaningful inside the project workspace. */
  tab: string;
  /** An open full-screen dialog. */
  modal: string | null;
  /** The mobile "more" drawer. */
  menu: boolean;
};

export { emptyScreen, sameScreen, closesOverlay, screenToSearch, screenFromSearch, historyActionFor } from "@/lib/navigation/screen-url.mjs";

type HistoryEntry = { codecoScreen?: AppScreen };

/**
 * Keeps the browser history in step with the screen the app is showing.
 *
 * - a new screen pushes an entry, so back returns to the previous one;
 * - closing a dialog consumes the entry it added, so back does not reopen it;
 * - the back button hands the stored screen back to the app instead of leaving it.
 */
export function useScreenHistory(screen: AppScreen, applyScreen: (screen: AppScreen) => void) {
  const currentRef = useRef<AppScreen | null>(null);
  // Set while the app is following the back button, so restoring never pushes again.
  const restoringRef = useRef(false);
  const applyRef = useRef(applyScreen);
  useEffect(() => {
    applyRef.current = applyScreen;
  }, [applyScreen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const previous = currentRef.current;
    const action = historyActionFor(previous, screen, restoringRef.current);
    // The flag only covers the one render that follows the back button; leaving it on
    // would silently swallow the next real navigation.
    restoringRef.current = false;
    if (action === "none") return;
    const url = `${window.location.pathname}${screenToSearch(screen)}`;
    const entry: HistoryEntry = { codecoScreen: screen };
    currentRef.current = screen;
    if (action === "replace") {
      // The first screen, and every screen the back button could not restore exactly.
      window.history.replaceState(entry, "", url);
      return;
    }
    if (action === "back") {
      // The dialog pushed an entry when it opened; closing it by hand spends that entry
      // so the back button does not bring the dialog back.
      window.history.back();
      return;
    }
    window.history.pushState(entry, "", url);
  }, [screen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPopState = (event: PopStateEvent) => {
      const restored = (event.state as HistoryEntry | null)?.codecoScreen;
      // No screen in this entry means the user is leaving the app or an overlay took
      // care of it; either way the app must not fight the browser.
      if (!restored) return;
      restoringRef.current = true;
      currentRef.current = restored;
      applyRef.current(restored);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
}

/**
 * The same promise for an overlay that lives inside one component — a photo detail, a
 * sketch pad, a picker. It adds one history entry while it is open, so the back button
 * closes it instead of leaving the screen behind it.
 */
export function useBackToClose(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  const marker = useRef(0);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);

  const handlePop = useCallback(() => {
    marker.current = 0;
    closeRef.current();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !open) return;
    const state = window.history.state as { codecoOverlay?: number } | null;
    let id: number;
    if (pendingOverlayRemoval && state?.codecoOverlay === pendingOverlayRemoval.id) {
      // The same overlay mounted again straight after unmounting (React StrictMode in
      // development, or a parent re-keying it). Keep its history entry instead of removing
      // it: the asynchronous back() would otherwise arrive now and close the new instance.
      window.clearTimeout(pendingOverlayRemoval.timer);
      id = pendingOverlayRemoval.id;
      pendingOverlayRemoval = null;
    } else {
      id = Date.now() + Math.random();
      window.history.pushState({ codecoOverlay: id }, "");
    }
    marker.current = id;
    window.addEventListener("popstate", handlePop);
    return () => {
      window.removeEventListener("popstate", handlePop);
      // Closed with the button instead of the back gesture: take the entry back out,
      // otherwise the next back press would only undo an overlay that is already gone.
      // Deferred by one task so an immediate remount can claim the entry first.
      const current = window.history.state as { codecoOverlay?: number } | null;
      if (marker.current === id && current?.codecoOverlay === id) {
        const timer = window.setTimeout(() => {
          pendingOverlayRemoval = null;
          const now = window.history.state as { codecoOverlay?: number } | null;
          if (now?.codecoOverlay === id) window.history.back();
        }, 0);
        pendingOverlayRemoval = { id, timer };
      }
      marker.current = 0;
    };
  }, [handlePop, open]);
}

let pendingOverlayRemoval: { id: number; timer: number } | null = null;
