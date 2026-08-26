// Phase 14 D1 — Manufacturing workflow.
//
// Verifies (signed in as Super Admin):
//  - Products list renders (table or empty state).
//  - Work Orders list renders.
//  - Batches list renders.
//  - Work Centers list renders.
//  - The "Manufacturing" nav section items are visible in the sidebar.
//
// The list pages fetch live data via the real API; the demo seed may or may not
// populate every entity, so we accept either a populated table or the localized
// "no data" empty state — both are valid real-world outcomes.

import { test, expect } from "@playwright/test";
import {
  signInAdmin,
  gotoLocale,
  expectListOrEmpty,
  expectSidebarItem,
} from "./_helpers";

test.describe("Manufacturing workflow", () => {
  test.beforeEach(async ({ page }) => {
    await signInAdmin(page);
  });

  test("Products list renders", async ({ page }) => {
    await gotoLocale(page, "/manufacturing/products");

    // Page heading — i18n: manufacturing.products.title = "Products".
    await expect(page.getByRole("heading", { name: /^products$/i })).toBeVisible();

    // Either a populated table OR the empty state (manufacturing.products.noData).
    // The empty-state copy is i18n-driven; we look for any visible paragraph in the card body.
    await expectListOrEmpty(page, "no data");
  });

  test("Work Orders list renders", async ({ page }) => {
    await gotoLocale(page, "/production/work-orders");

    // i18n: production.workOrders.title = "Work Orders".
    await expect(page.getByRole("heading", { name: /work orders/i })).toBeVisible();
    await expectListOrEmpty(page, "no data");
  });

  test("Batches list renders", async ({ page }) => {
    await gotoLocale(page, "/production/batches");

    // i18n: production.batches.title = "Manufacturing Batches".
    await expect(page.getByRole("heading", { name: /manufacturing batches/i })).toBeVisible();
    await expectListOrEmpty(page, "no data");
  });

  test("Work Centers list renders", async ({ page }) => {
    await gotoLocale(page, "/production/work-centers");

    // i18n: production.workCenters.title = "Work Centers".
    await expect(page.getByRole("heading", { name: /work centers/i })).toBeVisible();
    await expectListOrEmpty(page, "no data");
  });

  test("the Manufacturing nav section is visible in the sidebar", async ({ page }) => {
    // Sidebar groups by section but does not render section headers.
    // Verifying every manufacturing-section item is present proves the section is rendered.
    await expectSidebarItem(page, "Products");
    await expectSidebarItem(page, "Materials");
    await expectSidebarItem(page, "Material Lots");
    await expectSidebarItem(page, "Suppliers");

    // The production section (Work Orders / Batches / Work Centers / Shifts) is
    // also visible because admin has all read permissions.
    await expectSidebarItem(page, "Work Orders");
    await expectSidebarItem(page, "Batches");
    await expectSidebarItem(page, "Work Centers");
  });
});
