import { expect, test } from "@playwright/test";

/**
 * QA sweep M14, M18, L8, L31. The sign-in screen is a main landmark, a refused field says why in
 * a way a screen reader hears (role=alert, aria-invalid, aria-describedby), and a recovery link
 * that has expired is explained instead of being ignored.
 */
async function openLogin(page: import("@playwright/test").Page, hash = "") {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes");
    localStorage.setItem("codeco-language-choice", "nl");
  });
  // A link from a mail is a fresh page load; a hash-only change would not reload the app.
  await page.goto("about:blank");
  await page.goto(`/supervisie${hash}`);
  await page.locator(".access-form").waitFor({ state: "visible" });
}

test("a refused sign-in field is announced and linked to its message", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The markup is the same on every viewport.");
  await openLogin(page);
  await expect(page.getByRole("main")).toHaveCount(1);
  await page.locator(".access-form input[type='email']").fill("geen-adres");
  await page.locator(".access-form button[type='submit']").click();

  const email = page.locator(".access-form input[type='email']");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  const describedBy = await email.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  const message = page.locator(`#${describedBy}`);
  await expect(message).toHaveAttribute("role", "alert");
  await expect(message).toContainText(/e-mailadres/i);

  const password = page.locator(".access-form input[type='password']");
  await expect(password).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(`#${await password.getAttribute("aria-describedby")}`)).toHaveAttribute("role", "alert");
});

test("an expired recovery link is explained and a new one can be asked for", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The markup is the same on every viewport.");
  await openLogin(page, "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  await expect(page.locator(".access-message.error")).toContainText("Deze link is verlopen of al gebruikt");
  await expect(page.getByRole("button", { name: "Wachtwoord vergeten?" })).toBeVisible();
});
