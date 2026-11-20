import type { Locator } from "@playwright/test";

/**
 * Fills every empty field of the client's developer specification (FINAL v2) that a form
 * shows — the sections rendered by app/forms/spec-fields.tsx — with the first valid choice or
 * a plain test value. It repeats until nothing changes, because choosing a type reveals its
 * category list and "Other" reveals an explanation box.
 */
export async function fillSpecFields(scope: Locator) {
  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false;
    const fields = scope.locator("[data-spec-form] [data-spec-field]");
    const count = await fields.count();
    for (let index = 0; index < count; index += 1) {
      const field = fields.nth(index);
      if (!(await field.isVisible().catch(() => false))) continue;
      // A people picker: add one from the register, or a typed name when the register is empty.
      if (await field.locator(".spec-people-add").count()) {
        if (!(await field.locator(".spec-chips li").count())) {
          const add = field.locator(".spec-people-add select");
          const values = await add.locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value).filter(Boolean));
          if (values.length) await add.selectOption(values[0]);
          else {
            await field.locator(".spec-people-other").fill("E2E");
            await field.locator(".spec-people-add button").click();
          }
          changed = true;
        }
        continue;
      }
      const checkboxes = field.locator("input[type='checkbox']");
      if (await checkboxes.count()) {
        if (!(await field.locator("input[type='checkbox']:checked").count())) {
          await checkboxes.first().check();
          changed = true;
        }
      } else {
        const select = field.locator("select").first();
        if (await select.count()) {
          if (!(await select.inputValue())) {
            const values = await select.locator("option").evaluateAll((options) => options.filter((option) => !(option as HTMLOptionElement).disabled).map((option) => (option as HTMLOptionElement).value).filter(Boolean));
            const choice = values.find((value) => !/^other\b/i.test(value) && !/^not applicable/i.test(value)) ?? values[0];
            if (choice) {
              await select.selectOption(choice);
              changed = true;
            }
          }
        } else {
          const input = field.locator("input, textarea").first();
          if (await input.count() && !(await input.inputValue())) {
            const type = await input.getAttribute("type");
            const value = type === "number" ? "1" : type === "date" ? "2026-12-01" : type === "datetime-local" ? "2026-12-01T09:00" : type === "time" ? "08:00" : "E2E";
            await input.fill(value);
            changed = true;
          }
        }
      }
      for (const other of await field.locator(".spec-other input, .spec-other-name").all()) {
        if (!(await other.inputValue())) {
          await other.fill("E2E");
          changed = true;
        }
      }
    }
    if (!changed) return;
  }
}
