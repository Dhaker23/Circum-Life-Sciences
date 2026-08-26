// Phase 14 D1 — shared E2E helpers.
//
// D1 rule: "E2E tests must verify real user workflows, authorization boundaries,
// critical state transitions, and failure/denial behavior where applicable. Do
// not create fake success paths merely to make E2E tests pass."
//
// These helpers are intentionally minimal — they perform a real browser sign-in
// flow against the live dev server (no API short-circuit, no session-cookie
// injection). Each spec calls `signInAdmin` per-test so every test starts from
// a clean authenticated session.

import type { Page, APIRequestContext, APIResponse } from "@playwright/test";

export const BASE_URL = "http://localhost:3000";
export const SIGN_IN_URL = `${BASE_URL}/en/sign-in`;

export const DEMO_ADMIN_EMAIL = "admin@circum.demo";
export const DEMO_ADMIN_PASSWORD = "CircumDemo2025!";
export const DEMO_ADMIN_NAME = "Demo Super Admin";

/**
 * Perform the real browser sign-in flow as the demo Super Admin.
 * Mirrors exactly what a human operator does: type email, type password,
 * click submit, wait for the dashboard route to render.
 */
export async function signInAdmin(page: Page): Promise<void> {
  await page.goto(SIGN_IN_URL);
  await page.fill('input[type="email"]', DEMO_ADMIN_EMAIL);
  await page.fill('input[type="password"]', DEMO_ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  // After successful sign-in the client router pushes to "/" which next-intl
  // (localePrefix: "always") resolves to "/en".
  await page.waitForURL(/\/en$/);
}

/**
 * Navigate to a (app)-section page using the /en locale prefix.
 */
export async function gotoLocale(page: Page, path: string): Promise<void> {
  const clean = path.startsWith("/") ? path : `/${path}`;
  await page.goto(`${BASE_URL}/en${clean}`);
}

/**
 * Assert that the page either shows a populated list (a `<table>` with at least
 * one row) or the localized "no data" empty state — both are valid end states
 * for a list page (the demo seed may or may not populate every entity).
 *
 * Pass the localized empty-state text via `noDataText`.
 */
export async function expectListOrEmpty(
  page: Page,
  noDataText: string,
): Promise<void> {
  // The first card on every list page contains either a Table or the empty <p>.
  await Promise.race([
    expectTableWithRows(page),
    page
      .getByText(noDataText, { exact: false })
      .waitFor({ state: "visible" }),
  ]);
}

async function expectTableWithRows(page: Page): Promise<void> {
  const table = page.locator("table").first();
  await table.waitFor({ state: "visible" });
  // At least one body row (header doesn't count as data).
  await page.locator("table tbody tr").first().waitFor({ state: "attached" });
}

/**
 * Verify the sidebar renders a given nav item (by its translated label).
 * The sidebar groups items by section but does NOT render section headers, so
 * "the manufacturing nav section is visible" effectively means "the items
 * belonging to the manufacturing section are present in the sidebar".
 */
export async function expectSidebarItem(
  page: Page,
  label: string,
): Promise<void> {
  const nav = page.locator("nav").first();
  await nav.waitFor({ state: "visible" });
  await nav.getByRole("link", { name: label }).waitFor({ state: "visible" });
}

/**
 * Hit an authenticated API endpoint as a brand-new (unauthenticated) client.
 * Returns the raw Playwright APIResponse so the caller can assert on status / body.
 */
export async function fetchUnauthenticated(
  request: APIRequestContext,
  path: string,
): Promise<APIResponse> {
  return request.get(`${BASE_URL}${path}`);
}
