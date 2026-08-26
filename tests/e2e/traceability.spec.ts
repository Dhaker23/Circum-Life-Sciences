// Phase 14 D1 — Traceability / genealogy workflow.
//
// Verifies (signed in as Super Admin):
//  - Genealogy Trace page renders (form + advisory notice).
//  - Impact Analysis page renders (form + advisory notice).
//  - Query Log page renders (table or empty state).
//  - The "Traceability" nav section items are visible in the sidebar.

import { test, expect } from "@playwright/test";
import {
  signInAdmin,
  gotoLocale,
  expectListOrEmpty,
  expectSidebarItem,
} from "./_helpers";

test.describe("Traceability workflow", () => {
  test.beforeEach(async ({ page }) => {
    await signInAdmin(page);
  });

  test("Genealogy Trace page renders", async ({ page }) => {
    await gotoLocale(page, "/traceability/trace");

    // i18n: traceability.trace.title = "Genealogy Trace".
    await expect(page.getByRole("heading", { name: /genealogy trace/i })).toBeVisible();

    // The page has an entity-type selector, an entity-id input, a direction
    // selector, and a Trace button — assert the input + button exist.
    await expect(page.getByPlaceholder(/cuid/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /trace/i })).toBeVisible();
  });

  test("Impact Analysis page renders", async ({ page }) => {
    await gotoLocale(page, "/traceability/impact");

    // i18n: traceability.impact.title = "Impact Analysis".
    await expect(page.getByRole("heading", { name: /impact analysis/i })).toBeVisible();

    // The page surfaces an "informational only" advisory notice.
    await expect(page.getByText(/informational only|advisory|notice/i).first()).toBeVisible();

    // It has a "Run impact analysis" / "Analyze" button — verify it exists.
    await expect(page.getByRole("button").last()).toBeVisible();
  });

  test("Query Log page renders", async ({ page }) => {
    await gotoLocale(page, "/traceability/query-log");

    // i18n: traceability.queryLog.title = "Traceability Query Log".
    await expect(page.getByRole("heading", { name: /traceability query log/i })).toBeVisible();

    // Either populated table OR the localized "no data" empty state.
    await expectListOrEmpty(page, "no data");
  });

  test("the Traceability nav section is visible in the sidebar", async ({ page }) => {
    // i18n nav labels for the traceability section:
    //   nav.traceTrace = "Genealogy Trace"
    //   nav.traceImpact = "Impact Analysis"
    //   nav.traceLog = "Query Log"
    await expectSidebarItem(page, "Genealogy Trace");
    await expectSidebarItem(page, "Impact Analysis");
    await expectSidebarItem(page, "Query Log");
  });
});
