import type { Locator } from "@playwright/test";

/**
 * Developer package v5, Photos: the purpose is chosen first and its category second (both required for a
 * workbook photo). Chooses the purpose, then the first category it offers.
 */
export async function choosePhotoPurpose(review: Locator, purpose: string) {
  await review.getByLabel(/Photo purpose/).selectOption(purpose);
  const category = review.getByLabel(/Photo category/);
  await category.waitFor({ state: "visible" });
  const values = await category.locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value).filter(Boolean));
  if (values.length) await category.selectOption(values[0]);
}
