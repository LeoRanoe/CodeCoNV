import { createClient } from "@supabase/supabase-js";
import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * Who counts as "on site": Present, Late and a legacy row with no status count; Absent, On Leave, Off Shift,
 * Demobilized and visitors do not. Two buildings, the project total, the totals per organisation and per trade,
 * save and reload, the day log, and the attendance rows that stay in the database whatever their status.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const url = process.env.CODECO_E2E_SUPABASE_URL;
const key = process.env.CODECO_E2E_PUBLISHABLE_KEY;
test.skip(!email || !password || !url || !key, "A fixture account and the local Supabase keys are required.");

async function signIn(page: Page) {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes");
    localStorage.setItem("codeco-language-choice", "en");
  });
  await page.reload();
  const form = page.locator(".access-form");
  await form.waitFor({ state: "visible" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await form.locator("input[type='email']").fill(email!);
  await form.locator("input[type='password']").fill(password!);
  await form.locator("button[type='submit']").click();
  await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
}

async function openWorkforce(page: Page) {
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator('[data-workspace-destination="workforce"]').click();
  await expect(page.getByRole("heading", { name: "Who is on site today?" })).toBeVisible();
}

const tabCount = async (workforce: Locator, building: string) =>
  Number(await workforce.getByRole("tab", { name: new RegExp(`^${building}`) }).locator("b").textContent());

test("only the people on site are counted, per building and for the project, and every row is kept", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "One viewport is enough for the counting rule.");
  test.setTimeout(240_000);
  const stamp = Date.now().toString(36);
  // The last workday before today carries an Absent row (which does not count) and, from here, 20 people who are Present.
  // The supervisor's own access: what the screens read and write is what is checked.
  const admin = createClient(url!, key!, { auth: { persistSession: false } });
  const signedIn = await admin.auth.signInWithPassword({ email: email!, password: password! });
  expect(signedIn.error).toBeNull();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Paramaribo" }).format(new Date());
  const project = await admin.from("projects").select("id").eq("name", projectName).single();
  expect(project.error).toBeNull();
  const previousReport = await admin.from("day_reports").select("id,report_date").eq("project_id", project.data!.id).lt("report_date", today).order("report_date", { ascending: false }).limit(1).single();
  expect(previousReport.error).toBeNull();
  const template = await admin.from("attendance_entries").select("*").eq("day_report_id", previousReport.data!.id).limit(1).single();
  expect(template.error).toBeNull();
  const clone = Object.fromEntries(Object.entries(template.data as Record<string, unknown>).filter(([name]) => !(["id", "created_at", "updated_at", "version"].includes(name))));
  const seeded = await admin.from("attendance_entries").insert({ ...clone, headcount: 20, crew: `Previous day ${stamp}`, discipline: `Previous day ${stamp}`, entry_type: "workforce", spec: { attendance_status: "Present" }, idempotency_key: `previous-day-${stamp}` });
  expect(seeded.error).toBeNull();
  const previousRows = (await admin.from("attendance_entries").select("headcount,entry_type,spec").eq("day_report_id", previousReport.data!.id)).data ?? [];
  const previousOnSite = previousRows.filter((row) => row.entry_type !== "visitor" && !["Absent", "On Leave", "Off Shift", "Demobilized"].includes(String((row.spec as Record<string, string> | null)?.attendance_status ?? ""))).reduce((sum, row) => sum + row.headcount, 0);
  expect(previousOnSite).toBeGreaterThanOrEqual(20);

  await signIn(page);
  await openWorkforce(page);
  const workforce = page.locator(".workforce-form");
  const selects = workforce.locator(".workforce-sections select");
  const headline = workforce.locator(".workforce-headline strong");
  const baseline = { main: await tabCount(workforce, "Hoofdgebouw"), east: await tabCount(workforce, "Nieuwbouw Oost"), total: Number(await headline.textContent()) };

  const disciplines = await selects.nth(1).locator("option").evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).label).filter((label) => label && !/^(select|choose|kies)/i.test(label)));
  expect(disciplines.length).toBeGreaterThanOrEqual(5);

  // [building, crew, people, attendance status (blank = a row saved before statuses existed)]
  const plan: Array<[string, string, number, string]> = [
    ["Hoofdgebouw", `Present ${stamp}`, 4, "Present"],
    ["Hoofdgebouw", `Late ${stamp}`, 2, "Late"],
    ["Hoofdgebouw", `Legacy ${stamp}`, 1, ""],
    ["Nieuwbouw Oost", `Absent ${stamp}`, 3, "Absent"],
    ["Nieuwbouw Oost", `Leave ${stamp}`, 2, "On Leave"],
    ["Nieuwbouw Oost", `Off shift ${stamp}`, 1, "Off Shift"],
    ["Nieuwbouw Oost", `Demob ${stamp}`, 1, "Demobilized"],
    ["Nieuwbouw Oost", `East present ${stamp}`, 2, "Present"],
  ];
  const onSite = (status: string) => !["Absent", "On Leave", "Off Shift", "Demobilized"].includes(status);
  const expected = { main: baseline.main, east: baseline.east };
  // One row per building, organisation and trade (the database keeps it that way), so each crew has its own trade.
  // Trades already used today (an earlier run of this spec, or another test) are skipped, so a row is never merged into an existing one.
  const buildingNames = new Map(((await admin.from("buildings").select("id,name").eq("project_id", project.data!.id)).data ?? []).map((row) => [row.id as string, row.name as string]));
  const todayReport = await admin.from("day_reports").select("id").eq("project_id", project.data!.id).eq("report_date", today).maybeSingle();
  const usedToday = (todayReport.data
    ? (await admin.from("attendance_entries").select("building_id,discipline").eq("day_report_id", todayReport.data.id)).data ?? []
    : []);
  const freeTrades = (building: string) => disciplines.filter((name) => !usedToday.some((row) => buildingNames.get(row.building_id as string) === building && row.discipline === name));
  const free = { Hoofdgebouw: freeTrades("Hoofdgebouw"), "Nieuwbouw Oost": freeTrades("Nieuwbouw Oost") };
  expect(free.Hoofdgebouw.length).toBeGreaterThanOrEqual(3);
  expect(free["Nieuwbouw Oost"].length).toBeGreaterThanOrEqual(5);
  const tradeIndex = { Hoofdgebouw: 0, "Nieuwbouw Oost": 0 };
  const tradesUsed: Record<string, string[]> = { Hoofdgebouw: [], "Nieuwbouw Oost": [] };
  for (const [building, crew, people, status] of plan) {
    await workforce.getByRole("tab", { name: new RegExp(`^${building}`) }).click();
    await selects.nth(0).selectOption({ label: "Hoofdaannemer E2E" });
    const trade = free[building as keyof typeof free][tradeIndex[building as keyof typeof tradeIndex]++];
    tradesUsed[building].push(trade);
    await selects.nth(1).selectOption({ label: trade });
    await workforce.getByLabel("Crew · optional").fill(crew);
    for (let person = 0; person < people; person += 1) await workforce.getByRole("button", { name: "Add person", exact: true }).click();
    if (status) await workforce.locator(".workforce-row", { hasText: crew }).getByLabel(/^Attendance status of/).selectOption(status);
    if (onSite(status)) expected[building === "Hoofdgebouw" ? "main" : "east"] += people;
  }
  // A visitor is on site but is not part of the headcount.
  await workforce.getByRole("tab", { name: /^Hoofdgebouw/ }).click();
  await workforce.getByPlaceholder("Who visited the site?").fill(`Visitor ${stamp}`);
  await workforce.getByRole("button", { name: "Add visitor" }).click();

  await expect.poll(() => tabCount(workforce, "Hoofdgebouw")).toBe(expected.main);
  await expect.poll(() => tabCount(workforce, "Nieuwbouw Oost")).toBe(expected.east);
  const projectTotal = expected.main + expected.east;
  await expect(headline).toHaveText(String(projectTotal));
  // Totals per organisation and per trade use the same rule.
  const sumOf = (heading: string) => workforce.locator(".workforce-totals h4", { hasText: heading }).locator("xpath=..").locator("dd")
    .evaluateAll((cells) => cells.reduce((sum, cell) => sum + Number(cell.textContent), 0));
  await expect.poll(() => sumOf("Per organisation")).toBe(projectTotal);
  await expect.poll(() => sumOf("Per trade")).toBe(projectTotal);
  // A trade whose only crew is off site (here Demobilized, the fourth trade of Nieuwbouw Oost) is not listed at all; the Present one is.
  const trades = await workforce.locator(".workforce-totals h4", { hasText: "Per trade" }).locator("xpath=..").locator("dt").allTextContents();
  expect(trades).not.toContain(tradesUsed["Nieuwbouw Oost"][3]);
  expect(trades).toContain(tradesUsed["Nieuwbouw Oost"][4]);
  // The previous workday has a crew, so the day is compared with it (a deviation is only shown past the 20% threshold).
  const comparison = workforce.locator(".workforce-deviation-list li", { hasText: "Against the last workday" });
  await expect(comparison).toContainText(`${projectTotal} on site against ${previousOnSite}`);

  await workforce.getByPlaceholder("For example: two crews moved to the other building.").fill("Counting rule check: absent, leave, off-shift and demobilized crews are listed but not counted.");
  await workforce.getByRole("button", { name: /Confirm attendance/ }).click();
  await expect(page.locator(".record-row").filter({ hasText: `${expected.main} people on site` }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".record-row").filter({ hasText: `${expected.east} people on site` }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("workforce-saved.png"), fullPage: true });

  // The rows are all still there, whatever their status.
  const saved = await admin.from("attendance_entries").select("crew,headcount,entry_type,visitor_name,spec").or(`crew.ilike.%${stamp}%,visitor_name.ilike.%${stamp}%`);
  expect(saved.error).toBeNull();
  const byCrew = new Map((saved.data ?? []).map((row) => [row.crew ?? row.visitor_name, row]));
  for (const [, crew, people, status] of plan) {
    const row = byCrew.get(crew);
    expect(row, `${crew} is stored`).toBeTruthy();
    expect(row!.headcount).toBe(people);
    expect(((row!.spec ?? {}) as Record<string, string>).attendance_status ?? "").toBe(status);
  }
  expect(byCrew.get(`Visitor ${stamp}`)?.entry_type).toBe("visitor");

  // Reload: the saved day shows the same counts.
  await page.reload();
  // The address keeps the project and the screen, so the Workforce page comes back by itself.
  await expect(page.getByRole("heading", { name: "Who is on site today?" })).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => tabCount(page.locator(".workforce-form"), "Hoofdgebouw"), { timeout: 30_000 }).toBe(expected.main);
  await expect.poll(() => tabCount(page.locator(".workforce-form"), "Nieuwbouw Oost")).toBe(expected.east);
  await expect(page.locator(".workforce-form .workforce-headline strong")).toHaveText(String(projectTotal));

  // The day log reads the same crew, and the report counts it the same way.
  await page.locator(".sidebar").getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Day log" }).click();
  await expect(page.locator(".daily-log-form").getByText(new RegExp(`${projectTotal} people recorded today`))).toBeVisible({ timeout: 30_000 });
});
