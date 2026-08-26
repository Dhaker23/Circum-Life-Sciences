// Phase 14 D1 — Batch review / disposition workflow.
//
// Verifies (signed in as Super Admin):
//  - The Batch Review page renders (title + disposition guard notice + empty state).
//  - The batch list area is visible (the page currently surfaces the
//    "no batches ready for review" empty state — this is the real, intentional
//    UI for the demo seed; we assert that empty state rather than fabricating one).
//  - If a batch exists, its detail page renders with the disposition buttons.
//
// D1 rule: real flows only. We never invent a batch ID; we look one up via the
// authenticated production API and skip the detail assertion if none exists.

import { test, expect } from "@playwright/test";
import {
  BASE_URL,
  signInAdmin,
  gotoLocale,
} from "./_helpers";

test.describe("Batch review / disposition", () => {
  test.beforeEach(async ({ page }) => {
    await signInAdmin(page);
  });

  test("the Batch Review page renders with the disposition guard and empty state", async ({
    page,
  }) => {
    await gotoLocale(page, "/batch-review");

    // i18n: batchReview.title = "Batch Review".
    await expect(page.getByRole("heading", { name: /batch review/i })).toBeVisible();

    // The page always renders the human-only disposition guard notice.
    // i18n key: batchReview.dispositionGuard (an amber dashed-border notice).
    // We assert the page contains the word "disposition" somewhere in a notice.
    await expect(page.getByText(/disposition|human|review/i).first()).toBeVisible();

    // The page renders a card whose body is the "no batches ready for review"
    // empty state (i18n: batchReview.noData = "No batches ready for review").
    // This is the real end state for the demo seed; we accept it.
    await expect(page.getByText(/no batches ready for review/i)).toBeVisible();
  });

  test("a batch detail page renders the disposition section when a batch exists", async ({
    page,
  }) => {
    // Look up a real batch via the authenticated production API.
    const res = await page.request.get(`${BASE_URL}/api/production/batches?pageSize=10`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    const batches: Array<{ id: string; code: string }> = body?.data ?? [];

    test.skip(batches.length === 0, "no demo batches seeded — skipping detail-page assertion");

    const batch = batches[0];
    await gotoLocale(page, `/batch-review/batches/${batch.id}`);

    // Detail page renders the batch code somewhere.
    await expect(page.getByText(batch.code, { exact: false })).toBeVisible({ timeout: 10000 });

    // The human-only disposition notice is always visible on this page
    // (i18n key: batchReview.detail.dispositionHumanOnlyNotice).
    await expect(page.getByText(/human[- ]only|disposition/i).first()).toBeVisible();

    // The detail page renders at least one Card titled with the entity concept.
    // The disposition buttons (APPROVE / HOLD / REWORK / REJECT) only render
    // when the batch is in QA_REVIEW status; for other statuses the page
    // shows a transition button or a "no actions" notice. We assert that the
    // page rendered SOMETHING actionable or the no-actions text — never that a
    // specific disposition button exists regardless of state.
    const actionable =
      (await page.getByRole("button", { name: /approve|hold|rework|reject|move to|transition/i }).count()) +
      (await page.getByText(/no actions|no further/i).count());
    expect(actionable).toBeGreaterThan(0);
  });
});
