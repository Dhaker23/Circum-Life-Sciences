// Phase 14 D1 — Quality workflow.
//
// Verifies (signed in as Super Admin):
//  - NCRs list renders.
//  - If any NCR exists, its detail page renders with the Transition card
//    (D5 transition buttons).
//  - Deviations list renders.
//  - CAPAs list renders.
//  - Change Control list renders.
//  - The "Quality" nav section items are visible in the sidebar.
//
// D1 rule: real flows only. When an entity has zero demo rows, we verify the
// empty state rather than fabricating an ID.

import { test, expect } from "@playwright/test";
import {
  BASE_URL,
  signInAdmin,
  gotoLocale,
  expectListOrEmpty,
  expectSidebarItem,
} from "./_helpers";

test.describe("Quality workflow", () => {
  test.beforeEach(async ({ page }) => {
    await signInAdmin(page);
  });

  test("NCRs list renders", async ({ page }) => {
    await gotoLocale(page, "/quality/ncrs");

    // i18n: quality.ncrs.title = "Nonconformity Reports".
    await expect(page.getByRole("heading", { name: /nonconformity reports/i })).toBeVisible();
    await expectListOrEmpty(page, "no data");
  });

  test("an NCR detail page renders the Transition card with transition buttons", async ({
    page,
  }) => {
    // Discover a real NCR via the authenticated API (shares the browser session).
    const res = await page.request.get(`${BASE_URL}/api/quality/ncrs?pageSize=10`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    const ncrs: Array<{ id: string; code: string; status: string }> = body?.data ?? [];

    test.skip(ncrs.length === 0, "no demo NCRs seeded — skipping detail-page assertion");

    const ncr = ncrs[0];
    await gotoLocale(page, `/quality/ncrs/${ncr.id}`);

    // The detail page renders the NCR code somewhere prominent (h1 / paragraph).
    await expect(page.getByText(ncr.code, { exact: false })).toBeVisible();

    // The Transition card is always rendered (D5 UI mirror of the state machine).
    // i18n: common.transition = "Transition".
    const transitionCard = page.locator("header, div", { hasText: /^Transition$/ }).first();
    await expect(transitionCard).toBeVisible({ timeout: 10000 });

    // Either transition buttons are present, OR the "no further transitions"
    // notice is shown (terminal statuses like CLOSED/CANCELLED).
    // i18n: quality.ncrs.detail.noTransitions = "No further transitions available from this status."
    const hasButtons = await page.getByRole("button", { name: /move to|cancel ncr|close ncr/i }).count();
    const hasNoTransitions = await page.getByText(/no further transitions available/i).count();
    expect(hasButtons + hasNoTransitions).toBeGreaterThan(0);
  });

  test("Deviations list renders", async ({ page }) => {
    await gotoLocale(page, "/quality/deviations");
    // i18n: quality.deviations.title = "Deviations".
    await expect(page.getByRole("heading", { name: /^deviations$/i })).toBeVisible();
    await expectListOrEmpty(page, "no data");
  });

  test("CAPAs list renders", async ({ page }) => {
    await gotoLocale(page, "/quality/capas");
    // i18n: quality.capas.title = "CAPAs".
    await expect(page.getByRole("heading", { name: /^capas$/i })).toBeVisible();
    await expectListOrEmpty(page, "no data");
  });

  test("Change Control list renders", async ({ page }) => {
    await gotoLocale(page, "/quality/changes");
    // i18n: quality.changes.title = "Change Controls".
    await expect(page.getByRole("heading", { name: /change controls/i })).toBeVisible();
    await expectListOrEmpty(page, "no data");
  });

  test("the Quality nav section is visible in the sidebar", async ({ page }) => {
    // The Quality section in the sidebar groups: NCRs, Deviations,
    // Investigations, CAPAs, Change Control, Risk Assessments.
    await expectSidebarItem(page, "NCRs");
    await expectSidebarItem(page, "Deviations");
    await expectSidebarItem(page, "CAPAs");
    await expectSidebarItem(page, "Change Control");
  });
});
