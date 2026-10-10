"use client";

import { useEffect } from "react";

/**
 * One keyboard and focus contract for every dialog and sheet in the application.
 *
 * Any element that is `role="dialog"` / `role="alertdialog"` with `aria-modal="true"` is picked
 * up the moment it enters the document, so a new dialog needs no extra wiring:
 *
 * - focus moves inside (the first field or button, or the dialog itself),
 * - Tab and Shift+Tab stay inside the topmost dialog,
 * - everything outside the topmost dialog is `inert` (no focus, no clicks, hidden from screen readers),
 * - Escape closes the topmost dialog by pressing its own close control, so a dialog that keeps
 *   unsaved work or is busy still decides for itself; `data-dialog-escape="off"` opts a dialog out,
 * - the page behind does not scroll,
 * - when the dialog goes away, focus returns to the control that opened it.
 */

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const dialogSelector = "[role='dialog'][aria-modal='true'], [role='alertdialog'][aria-modal='true']";
const triggerSelector = "button, a[href], summary, [role='button'], [role='tab'], input, select, textarea";

type Entry = { dialog: HTMLElement; opener: HTMLElement | null };

function isShown(element: HTMLElement) {
  if (element.closest("[inert]") && !element.closest(dialogSelector)) return false;
  const style = getComputedStyle(element);
  if (style.visibility === "hidden" || style.display === "none") return false;
  return element.getClientRects().length > 0;
}

function focusableIn(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(isShown);
}

/** The control a dialog offers for closing itself. */
function closeControl(dialog: HTMLElement): HTMLElement | null {
  const explicit = dialog.querySelector<HTMLElement>("[data-dialog-close]");
  if (explicit) return explicit;
  const header = dialog.querySelector<HTMLElement>("header, .modal-header, .field-guide-header") ?? dialog;
  const named = Array.from(header.querySelectorAll<HTMLElement>("button")).find((button) =>
    /^(close|sluiten|annuleren|cancel)\b/i.test(button.getAttribute("aria-label") ?? ""));
  return named ?? dialog.querySelector<HTMLElement>(".modal-close");
}

function closeDialog(dialog: HTMLElement) {
  const control = closeControl(dialog);
  if (control) {
    if (!(control as HTMLButtonElement).disabled && control.getAttribute("aria-disabled") !== "true") control.click();
    return;
  }
  // A sheet that closes by tapping the backdrop and has no close button of its own.
  const backdrop = dialog.parentElement;
  backdrop?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
}

export function DialogManager() {
  useEffect(() => {
    const stack: Entry[] = [];
    const inertByUs = new Set<HTMLElement>();
    let lastTrigger: HTMLElement | null = null;
    const previousOverflow = { value: "" };
    let scrollLocked = false;

    const rememberTrigger = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const candidate = target.closest<HTMLElement>(triggerSelector);
      if (candidate) lastTrigger = candidate;
    };

    const applyInert = () => {
      for (const element of inertByUs) element.inert = false;
      inertByUs.clear();
      const top = stack[stack.length - 1]?.dialog;
      if (!top) return;
      // Everything that is neither the dialog, one of its ancestors, nor a live region goes inert.
      let node: HTMLElement | null = top;
      while (node && node !== document.body) {
        const parent: HTMLElement | null = node.parentElement;
        if (!parent) break;
        for (const sibling of Array.from(parent.children)) {
          if (!(sibling instanceof HTMLElement) || sibling === node) continue;
          if (sibling.matches("script, style, link, [aria-live], [role='status'], [role='alert'], [data-dialog-allow]")) continue;
          if (sibling.inert) continue;
          sibling.inert = true;
          inertByUs.add(sibling);
        }
        node = parent;
      }
    };

    const lockScroll = () => {
      if (scrollLocked) return;
      scrollLocked = true;
      previousOverflow.value = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    };
    const unlockScroll = () => {
      if (!scrollLocked) return;
      scrollLocked = false;
      document.body.style.overflow = previousOverflow.value;
    };

    const moveFocusInside = (dialog: HTMLElement) => {
      if (dialog.contains(document.activeElement) && document.activeElement !== dialog) return;
      const preferred = dialog.querySelector<HTMLElement>("[data-autofocus], [autofocus]");
      const target = preferred && isShown(preferred) ? preferred : focusableIn(dialog)[0];
      if (target) target.focus({ preventScroll: true });
      else {
        if (!dialog.hasAttribute("tabindex")) dialog.setAttribute("tabindex", "-1");
        dialog.focus({ preventScroll: true });
      }
    };

    const sync = () => {
      const present = Array.from(document.querySelectorAll<HTMLElement>(dialogSelector));
      let changed = false;
      // Dialogs that went away.
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        const entry = stack[index];
        if (document.contains(entry.dialog)) continue;
        stack.splice(index, 1);
        changed = true;
        if (stack.length === 0) {
          unlockScroll();
          const opener = entry.opener;
          // After React has removed the dialog, put the user back where they were.
          window.requestAnimationFrame(() => {
            if (stack.length > 0) return;
            if (opener && document.contains(opener) && isShown(opener)) opener.focus({ preventScroll: true });
          });
        }
      }
      // Dialogs that appeared, in document order.
      for (const dialog of present) {
        if (stack.some((entry) => entry.dialog === dialog)) continue;
        const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const opener = stack.length > 0
          ? stack[stack.length - 1].dialog.contains(active) ? active : lastTrigger
          : lastTrigger && document.contains(lastTrigger) ? lastTrigger : active && active !== document.body ? active : null;
        stack.push({ dialog, opener });
        changed = true;
        lockScroll();
      }
      if (changed) {
        applyInert();
        const top = stack[stack.length - 1]?.dialog;
        if (top) window.requestAnimationFrame(() => moveFocusInside(top));
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const top = stack[stack.length - 1]?.dialog;
      if (!top) return;
      if (event.key === "Escape") {
        if (event.defaultPrevented) return;
        if (top.getAttribute("data-dialog-escape") === "off") return;
        event.preventDefault();
        event.stopPropagation();
        closeDialog(top);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableIn(top);
      if (focusable.length === 0) {
        event.preventDefault();
        top.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!top.contains(active) || active === top) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Focus that somehow lands outside the dialog (a script, a browser extension) is brought back.
    const onFocusIn = (event: FocusEvent) => {
      const top = stack[stack.length - 1]?.dialog;
      const target = event.target instanceof Element ? event.target : null;
      if (!top || !target || top.contains(target)) return;
      if (target.closest("[aria-live], [role='status'], [role='alert'], [data-dialog-allow]")) return;
      moveFocusInside(top);
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", rememberTrigger, true);
    document.addEventListener("pointerdown", rememberTrigger, true);
    document.addEventListener("focusin", onFocusIn);
    sync();

    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", rememberTrigger, true);
      document.removeEventListener("pointerdown", rememberTrigger, true);
      document.removeEventListener("focusin", onFocusIn);
      for (const element of inertByUs) element.inert = false;
      unlockScroll();
    };
  }, []);

  return null;
}
