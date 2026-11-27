"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => undefined;

/**
 * A popup is drawn at the root of the page (OPUS-F31). Opened from inside a form it used to live inside the form's
 * sticky action bar (its own stacking layer) and a container-query box (which is also the box a fixed element is
 * placed in), so on a phone the top bar and the bottom bar covered the signing popup and its "Sign & submit" button.
 * React events still bubble through the component tree, so handlers behave as before.
 */
export function ModalLayer({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
