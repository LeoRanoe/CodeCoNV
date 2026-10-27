import { expect, test } from "@playwright/test";

/**
 * The forms are filled in on a phone, one-handed, on a site. Four things kept going wrong
 * there and none of them show on a desktop screen:
 *
 * 1. The bar that saves a record is sticky at the bottom of the form, and the mobile
 *    navigation is fixed at the bottom of the screen. Pinned to the same edge, the save
 *    bar spent the whole form hidden behind the navigation.
 * 2. Buttons drawn for a mouse — a 34px ghost button, a 36px cross, a 28px clear — are
 *    below what a thumb reliably hits.
 * 3. A tick box left at the browser's own 13px is not a target at all, and the checklists
 *    and the "immediate action taken" grid are made of them.
 * 4. A label at 10px and a validation message at 9px cannot be read at arm's length.
 *
 * Like the other audits here the fixture is injected into the app route, which is where
 * the workspace stylesheet ships, and measured inside a single evaluate so no hydration
 * pass can slip in between. The entrance animations are switched off first: a modal
 * measured mid-animation reports its scaled size, not its laid-out size.
 */

const phones = [
  { name: "small phone", width: 320 },
  { name: "phone", width: 390 },
];

/** The record form as `RecordFormShell` and the operational workspace render it. */
const recordForm = `<div class="app-shell"><main class="main-content">
  <div class="operation-form record-form-shell sectioned-record-form wide">
    <div class="operation-form-heading sectioned-record-heading">
      <button class="record-back-button" type="button" aria-label="Terug"></button>
      <div><span class="record-number">ISS-2026-0007</span><h2>Issue melden</h2></div>
      <button class="ui-button ui-button--secondary ui-button--md record-heading-draft" type="button">Concept parkeren</button>
    </div>
    <div class="record-form-validation" role="alert"><strong>Controleer voor opslaan</strong><ul><li>Kies minstens één gebouw</li></ul></div>
    <div class="record-form-sections">
      <section class="record-form-section"><header class="record-form-section-heading"><span class="record-form-section-number">1</span><div><h3>Wat is er mis</h3><p>Beschrijf het probleem.</p></div></header>
        <div class="record-form-section-body">
          <label class="form-field"><span>Omschrijving</span><textarea rows="4"></textarea><small class="field-error">Vul een omschrijving in</small></label>
          <div class="record-severity-choices">
            ${[["low", "Laag"], ["medium", "Middel"], ["high", "Hoog"], ["critical", "Kritiek"]].map(([tone, label]) => `<button class="record-severity-choice record-severity-choice-${tone}" type="button">${label}</button>`).join("")}
          </div>
          <div class="record-action-grid">
            ${["Werk stilgelegd", "Gebied afgezet"].map((label) => `<label class="record-action-check"><input type="checkbox" /> ${label}</label>`).join("")}
          </div>
          <label class="form-field record-responsible-field"><select><option>Ranoe Leo</option></select><button class="record-field-clear" type="button" aria-label="Wissen"></button></label>
          <label class="check-field"><input type="checkbox" /> Escalatie nodig</label>
          <p class="form-helper">De deadline volgt de ernst van het issue.</p>
        </div>
      </section>
    </div>
    <div class="record-form-actions">
      <button class="ui-button ui-button--quiet ui-button--md" type="button">Annuleren</button>
      <label class="record-attachment-count">2 bijlagen<input type="file" /></label>
    </div>
    <div class="record-form-footer">
      <button class="ui-button ui-button--quiet ui-button--md" type="button">Annuleren</button>
      <button class="ui-button ui-button--primary ui-button--md" type="button">Registratie opslaan</button>
    </div>
  </div>
</main></div>
<nav class="mobile-bottom-nav">${["Vandaag", "Project", "Foto", "Acties", "Meer"].map((label) => `<button class="mobile-nav-button" type="button">${label}</button>`).join("")}</nav>`;

/** A checklist run, whose own sticky bar shares the bottom edge with the navigation. */
const checklistRun = `<div class="app-shell"><main class="main-content">
  <div class="operation-form wide">
    <div class="checklist-run">
      ${[1, 2, 3].map((index) => `<fieldset class="checklist-question"><legend>Is de wapening geplaatst volgens tekening?</legend>
        <div class="answer-options"><label><input type="radio" name="q${index}" /> Ja</label><label><input type="radio" name="q${index}" /> Nee</label><label><input type="radio" name="q${index}" /> N.v.t.</label></div>
      </fieldset>`).join("")}
    </div>
    <div class="form-actions checklist-sticky-actions"><button class="ui-button ui-button--secondary ui-button--md" type="button">Later afronden</button><button class="ui-button ui-button--primary ui-button--md" type="button">Inspectie afronden</button></div>
  </div>
</main></div>
<nav class="mobile-bottom-nav">${["Vandaag", "Project", "Foto", "Acties", "Meer"].map((label) => `<button class="mobile-nav-button" type="button">${label}</button>`).join("")}</nav>`;

type Measurements = {
  /** How far the lowest edge of a sticky form bar reaches past the top of the navigation. */
  stickyBarsUnderNav: string[];
  shortTargets: string[];
  smallTickBoxes: string[];
  smallCopy: string[];
  zoomingFields: string[];
  overflow: number;
};

async function measure(page: import("@playwright/test").Page, markup: string): Promise<Measurements> {
  return page.evaluate((html): Measurements => {
    document.body.innerHTML = html;
    // A modal or a sheet measured while its entrance animation runs reports a scaled box.
    document.head.insertAdjacentHTML("beforeend", "<style>*,*::before,*::after{animation:none !important;transition:none !important}</style>");
    const name = (element: Element) => {
      const classes = typeof element.className === "string" && element.className.trim()
        ? `.${element.className.trim().split(/\s+/).join(".")}`
        : "";
      return `${element.tagName.toLowerCase()}${classes}`;
    };

    const navigation = document.querySelector(".mobile-bottom-nav");
    const navigationTop = navigation ? navigation.getBoundingClientRect().top : Number.POSITIVE_INFINITY;
    const stickyBarsUnderNav: string[] = [];
    for (const bar of document.querySelectorAll(".record-form-footer, .checklist-sticky-actions")) {
      const box = bar.getBoundingClientRect();
      if (box.bottom > navigationTop + 1) stickyBarsUnderNav.push(`${name(bar)} reaches ${Math.round(box.bottom - navigationTop)}px into the navigation`);
    }

    const shortTargets: string[] = [];
    const smallTickBoxes: string[] = [];
    const zoomingFields: string[] = [];
    for (const element of document.querySelectorAll("button, select, textarea, input, label:has(> input[type='checkbox']), label:has(> input[type='radio'])")) {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (!box.width && !box.height) continue;
      const type = element instanceof HTMLInputElement ? element.type : "";
      if (type === "checkbox" || type === "radio") {
        if (box.width < 20 || box.height < 20) smallTickBoxes.push(`${name(element)}[${type}] ${Math.round(box.width)}x${Math.round(box.height)}`);
        continue;
      }
      // A field only carries its own line where it is the target; inside a label that
      // wraps it, the label is what the thumb lands on and that is measured instead.
      if (type === "file" || style.position === "absolute") continue;
      if (element.closest("label.record-action-check, label.check-field, label.record-attachment-count") && element.tagName === "INPUT") continue;
      if (box.height < 44) shortTargets.push(`${name(element)} h=${box.height.toFixed(1)}`);
      if (["INPUT", "SELECT", "TEXTAREA"].includes(element.tagName) && Number.parseFloat(style.fontSize) < 16) {
        zoomingFields.push(`${name(element)} ${style.fontSize}`);
      }
    }

    const smallCopy: string[] = [];
    for (const element of document.querySelectorAll(".form-field > span:first-child, .form-field > small, .form-helper, .field-error, .record-counter, .record-photo-hint")) {
      const size = Number.parseFloat(getComputedStyle(element).fontSize);
      if (size < 12) smallCopy.push(`${name(element)} ${size}px`);
    }

    return {
      stickyBarsUnderNav,
      shortTargets: [...new Set(shortTargets)],
      smallTickBoxes: [...new Set(smallTickBoxes)],
      smallCopy: [...new Set(smallCopy)],
      zoomingFields: [...new Set(zoomingFields)],
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth,
    };
  }, markup);
}

for (const phone of phones) {
  for (const [surface, markup] of [["record form", recordForm], ["checklist run", checklistRun]] as const) {
    test(`${surface} stays usable with a thumb on a ${phone.name} (${phone.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: phone.width, height: 780 });
      await page.goto("/supervisie", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const seen = await measure(page, markup);

      expect(seen.stickyBarsUnderNav, `sticky bars behind the navigation at ${phone.width}px`).toEqual([]);
      expect(seen.shortTargets, `targets under 44px at ${phone.width}px`).toEqual([]);
      expect(seen.smallTickBoxes, `tick boxes under 20px at ${phone.width}px`).toEqual([]);
      expect(seen.smallCopy, `label and message copy under 12px at ${phone.width}px`).toEqual([]);
      expect(seen.zoomingFields, `fields that make the browser zoom at ${phone.width}px`).toEqual([]);
      expect(seen.overflow, `horizontal overflow at ${phone.width}px`).toBeLessThanOrEqual(1);
    });
  }
}
