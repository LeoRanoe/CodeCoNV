"use client";

import { useEffect } from "react";

/**
 * The action centre sends a supervisor to a record, not to the list the record happens to
 * stand in. Tapping a line there used to open the module and leave the person scrolling for
 * the thing they just tapped — the dead end the client described. Every list that an action
 * centre row can point at gives its rows this anchor, so the record can be scrolled to and
 * marked when the module opens.
 */
export function recordAnchorId(recordId: string) {
  return `record-${recordId}`;
}

/**
 * Scrolls the requested record into view once the list around it has rendered. It runs only
 * for the record that was actually asked for, so an ordinary visit to the module keeps the
 * scroll position the user chose.
 */
export function useRecordFocus(recordId: string, present: boolean) {
  useEffect(() => {
    if (!recordId || !present || typeof window === "undefined") return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(recordAnchorId(recordId))?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [present, recordId]);
}
