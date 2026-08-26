// Phase 14 D1 — Analytics workflow.
//
// Verifies (signed in as Super Admin — has analytics.read AND analytics.corporate.read):
//  - Dashboards overview renders with KPI cards.
//  - OEE dashboard renders.
//  - Quality dashboard renders.
//  - Downtime dashboard renders.
//  - Critical Problems dashboard renders.
//  - Overdue Actions dashboard renders.
//  - Delivery dashboard renders AND surfaces "Data Unavailable" (PRD: delivery
//    analytics intentionally not implemented; the page asserts this honestly).
//  - Reports index renders (6 report cards).
//  - Corporate analytics renders (admin has analytics.corporate.read).
//  - The "Analytics" nav section items are visible in the sidebar.
//
// D1 rule: real flows only. The Delivery dashboard test does NOT fake success —
// it verifies the honest "Data Unavailable" fallback the app deliberately shows.

import { test, expect } from "@playwright/test";
import {
  signInAdmin,
  gotoLocale,
  expectSidebarItem,
} from "./_helpers";

test.describe("Analytics workflow", () => {
  test.beforeEach(async ({ page }) => {
    await signInAdmin(page);
  });

  test("Analytics Dashboards overview renders with KPI cards", async ({ page }) => {
    await gotoLocale(page, "/analytics/dashboards");

    // i18n: analytics.dashboards.title = "Analytics Dashboards".
    await expect(page.getByRole("heading", { name: /analytics dashboards/i })).toBeVisible();

    // The overview page renders a SiteSelector + DateRangePicker, then KPI cards.
    // KPI cards have a CardTitle with the KPI label + a value or "Data unavailable".
    // We assert that AT LEAST one Card renders in the body (KPI cards are always
    // rendered once the page mounts, even if values are "Data unavailable").
    // Wait for the loading skeleton to clear OR the cards to render.
    await expect(page.locator("main").locator("div.text-2xl, p.italic").first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("OEE dashboard renders", async ({ page }) => {
    await gotoLocale(page, "/analytics/dashboards/oee");
    // i18n: analytics.dashboards.oee = "OEE".
    await expect(page.getByRole("heading", { name: /^oee$/i }).first()).toBeVisible();
    // The page renders a Card with site/date controls.
    await expect(page.locator("main").locator("div.border").first()).toBeVisible();
  });

  test("Quality dashboard renders", async ({ page }) => {
    await gotoLocale(page, "/analytics/dashboards/quality");
    // i18n: analytics.dashboards.quality = "Quality".
    await expect(page.getByRole("heading", { name: /^quality$/i }).first()).toBeVisible();
  });

  test("Downtime dashboard renders", async ({ page }) => {
    await gotoLocale(page, "/analytics/dashboards/downtime");
    // i18n: analytics.dashboards.downtime = "Downtime".
    await expect(page.getByRole("heading", { name: /^downtime$/i }).first()).toBeVisible();
  });

  test("Critical Problems dashboard renders", async ({ page }) => {
    await gotoLocale(page, "/analytics/dashboards/critical-problems");
    // i18n: analytics.dashboards.criticalProblems = "Critical Problems".
    await expect(page.getByRole("heading", { name: /critical problems/i })).toBeVisible();
  });

  test("Overdue Actions dashboard renders", async ({ page }) => {
    await gotoLocale(page, "/analytics/dashboards/overdue-actions");
    // i18n: analytics.dashboards.overdueActions = "Overdue Actions".
    await expect(page.getByRole("heading", { name: /overdue actions/i })).toBeVisible();
  });

  test("Delivery dashboard renders and honestly shows 'Data Unavailable'", async ({ page }) => {
    await gotoLocale(page, "/analytics/dashboards/delivery");
    // i18n: analytics.dashboards.delivery = "Delivery Performance".
    await expect(page.getByRole("heading", { name: /delivery performance/i })).toBeVisible();

    // The Delivery dashboard is intentionally unimplemented (PRD); the page must
    // surface the honest "Data Unavailable" fallback rather than fabricate a
    // number. i18n: analytics.dashboards.dataUnavailable = "Data Unavailable".
    await expect(page.getByText(/data unavailable/i).first()).toBeVisible({ timeout: 15000 });
  });

  test("Reports index renders the 6 report cards", async ({ page }) => {
    await gotoLocale(page, "/analytics/reports");

    // i18n: analytics.reports.title = "Analytics Reports".
    await expect(page.getByRole("heading", { name: /analytics reports/i })).toBeVisible();

    // The reports index lists 6 report cards (OEE Trend, Quality Trend,
    // Downtime Pareto, Equipment Performance, Recurrence, Action Effectiveness).
    await expect(page.getByRole("link", { name: /oee trend/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /quality trend/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /downtime pareto/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /equipment performance/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /recurrence/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /action effectiveness/i })).toBeVisible();
  });

  test("Corporate analytics renders (admin has analytics.corporate.read)", async ({ page }) => {
    await gotoLocale(page, "/analytics/corporate");

    // i18n: analytics.corporate.title = "Corporate Analytics".
    await expect(page.getByRole("heading", { name: /corporate analytics/i })).toBeVisible();

    // The page renders metric checkboxes + a "compute" button + result KPIs
    // (or the loading skeleton). Either is acceptable; verify a Card rendered.
    await expect(page.locator("main").locator("div.border, div.rounded-lg").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("the Analytics nav section is visible in the sidebar", async ({ page }) => {
    // i18n nav labels for the analytics section:
    //   nav.analyticsDashboards = "Dashboards"
    //   nav.analyticsReports = "Reports"
    //   nav.analyticsVsm = "VSM Analytics"
    //   nav.analyticsCorporate = "Corporate"
    await expectSidebarItem(page, "Dashboards");
    await expectSidebarItem(page, "Reports");
    await expectSidebarItem(page, "Corporate");
  });
});
