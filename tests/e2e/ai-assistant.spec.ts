// Phase 14 D1 — AI Assistant workflow.
//
// Verifies (signed in as Super Admin — has ai.chat permission):
//  - The AI Assistant page renders.
//  - The persistent advisory notice is visible ("AI-generated advisory
//    information. Not an approval or official decision. Human review required.").
//  - The conversation sidebar renders (desktop lg+ viewport).
//  - The site selector renders.
//  - The capability selector renders.
//  - The input box renders.
//  - Sending a question produces a response — EITHER a structured response
//    OR the "AI provider unavailable" fallback. BOTH are valid end states
//    (the sandbox cannot reach the cloud AI provider; D6 fallback is the
//    EXPECTED outcome in that environment).
//  - The "AI" nav section item is visible in the sidebar.
//
// D1 rule: this test does NOT assert a successful AI response — it asserts
// that the page produces ONE of the two real, code-defined outcomes.

import { test, expect } from "@playwright/test";
import {
  signInAdmin,
  gotoLocale,
  expectSidebarItem,
} from "./_helpers";

// The advisory notice is rendered as plain text in an Alert — keep the literal
// string here so any drift in the i18n value is caught.
const ADVISORY_NOTICE =
  "AI-generated advisory information. Not an approval or official decision. Human review required.";
const AI_UNAVAILABLE = "AI provider unavailable";
const AI_RATE_LIMITED = "Rate limit exceeded";

test.describe("AI Assistant", () => {
  test.beforeEach(async ({ page }) => {
    await signInAdmin(page);
  });

  test("the AI Assistant page renders with advisory notice, sidebar, selectors and input", async ({
    page,
  }) => {
    await gotoLocale(page, "/ai-assistant");

    // i18n: ai.title = "AI Assistant".
    await expect(page.getByRole("heading", { name: /ai assistant/i })).toBeVisible();

    // Persistent advisory notice (amber banner across the top of the chat panel).
    await expect(page.getByText(ADVISORY_NOTICE)).toBeVisible();

    // Conversation sidebar — visible on lg+ viewport (default Desktop Chrome is 1280×720).
    // i18n: ai.conversations = "Conversations".
    const sidebar = page.locator("nav, aside, .lg\\:block").filter({ hasText: /conversations/i }).first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Site selector (renders after /api/org/sites loads). The selector's trigger
    // has an aria-label of "Select a site" (i18n: ai.selectSite).
    await expect(page.getByRole("combobox", { name: /select a site/i })).toBeVisible({
      timeout: 15000,
    });

    // Capability selector. aria-label = "Capability" (i18n: ai.capability).
    await expect(page.getByRole("combobox", { name: /^capability$/i })).toBeVisible();

    // Input box — Textarea with placeholder "Ask about OEE, quality, batches, trends..."
    // (i18n: ai.placeholder). aria-label is the same placeholder.
    const input = page.getByPlaceholder(/ask about oee/i);
    await expect(input).toBeVisible();

    // Send button (i18n: ai.send = "Send").
    await expect(page.getByRole("button", { name: /send/i })).toBeVisible();
  });

  test("sending a question yields either a structured response OR the unavailable fallback", async ({
    page,
  }) => {
    await gotoLocale(page, "/ai-assistant");

    // Wait for the site selector to mount — sending is disabled until a site is
    // selected (the page auto-selects the first site from /api/org/sites).
    const siteSelector = page.getByRole("combobox", { name: /select a site/i });
    await expect(siteSelector).toBeVisible({ timeout: 15000 });

    // Wait for the Send button to become enabled (site auto-selected).
    const sendButton = page.getByRole("button", { name: /send/i });
    await expect(sendButton).toBeEnabled({ timeout: 15000 });

    // Type a real question.
    const input = page.getByPlaceholder(/ask about oee/i);
    await input.fill("What is the current OEE for the demo site?");

    // Send the question.
    await sendButton.click();

    // The page now either:
    //   (a) appends an ASSISTANT message bubble with a structured response
    //       (the StructuredResponseView renders a section labeled "Answer"), OR
    //   (b) appends an ASSISTANT message bubble that is an Alert with title
    //       "AI provider unavailable. Core workflows continue to function normally."
    //   (c) sets an inline error Alert (also "AI provider unavailable" or
    //       "Rate limit exceeded") — same fallback family.
    //
    // Both (b) and (c) are the D6 sandbox-expected outcome; (a) is the
    // cloud-AI outcome. We accept ANY of the three.
    await Promise.race([
      page.getByText(/^answer$/i).waitFor({ state: "visible", timeout: 30000 }),
      page.getByText(new RegExp(AI_UNAVAILABLE, "i")).waitFor({ state: "visible", timeout: 30000 }),
      page.getByText(new RegExp(AI_RATE_LIMITED, "i")).waitFor({ state: "visible", timeout: 30000 }),
    ]);

    // Sanity: the question we typed is echoed back as a USER bubble somewhere
    // in the messages region (the page prepends it before the response).
    await expect(page.getByText(/current oee for the demo site/i)).toBeVisible();
  });

  test("the AI nav section is visible in the sidebar", async ({ page }) => {
    // i18n nav.aiAssistant = "AI Assistant".
    await expectSidebarItem(page, "AI Assistant");
  });
});
