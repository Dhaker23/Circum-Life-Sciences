// Phase 14 D1 — Authentication workflow.
//
// Verifies:
//  1. Valid credentials → dashboard.
//  2. Invalid credentials → error alert shown, NOT redirected.
//  3. Sign-out → redirected to sign-in page.
//  4. Unauthenticated access to a protected API endpoint → 401 JSON (not a redirect).
//
// D1 rule: real flows only. No fake success paths.

import { test, expect } from "@playwright/test";
import {
  BASE_URL,
  SIGN_IN_URL,
  DEMO_ADMIN_EMAIL,
  DEMO_ADMIN_PASSWORD,
  DEMO_ADMIN_NAME,
  signInAdmin,
  fetchUnauthenticated,
} from "./_helpers";

test.describe("Authentication", () => {
  test("valid credentials redirect to the dashboard", async ({ page }) => {
    await signInAdmin(page);

    // URL is the locale root /en (dashboard route).
    await expect(page).toHaveURL(/\/en$/);

    // Dashboard renders its heading (i18n: dashboard.welcome = "Welcome to Circum").
    await expect(page.getByRole("heading", { name: /welcome to circum/i })).toBeVisible();

    // Sidebar is present — proves we crossed the auth boundary into the app shell.
    await expect(page.locator("nav").first()).toBeVisible();
  });

  test("invalid credentials show an error and do NOT redirect", async ({ page }) => {
    await page.goto(SIGN_IN_URL);
    await page.fill('input[type="email"]', DEMO_ADMIN_EMAIL);
    await page.fill('input[type="password"]', "DefinitelyWrongPassword123!");
    await page.click('button[type="submit"]');

    // i18n: auth.invalidCredentials = "Invalid email or password"
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();

    // Still on the sign-in route — no dashboard leak.
    await expect(page).toHaveURL(/\/sign-in/);

    // The sidebar must NOT have rendered (would only show after sign-in).
    await expect(page.locator("nav")).toHaveCount(0);
  });

  test("sign-out redirects to the sign-in page", async ({ page }) => {
    await signInAdmin(page);

    // Open the user dropdown in the topbar (button contains the admin's name).
    const userButton = page.getByRole("button", { name: new RegExp(DEMO_ADMIN_NAME, "i") });
    await userButton.first().click();

    // Click the "Sign out" menu item (i18n: auth.signOut = "Sign out").
    await page.getByRole("menuitem", { name: /sign out/i }).click();

    // next-auth redirects to /{locale}/sign-in (callbackUrl configured in topbar).
    await page.waitForURL(/\/sign-in/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/sign-in/);

    // The sign-in card is visible again.
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("unauthenticated GET /api/identity/users returns 401 JSON (not a redirect)", async ({
    request,
  }) => {
    const res = await fetchUnauthenticated(request, "/api/identity/users");

    // 401, never 200/302/307.
    expect(res.status()).toBe(401);

    const body = await res.json();
    // Proxy.ts returns { error: { code: "UNAUTHORIZED", message: "Authentication required" } }.
    expect(body?.error?.code).toBe("UNAUTHORIZED");
    expect(body?.error?.message).toMatch(/authentication required/i);

    // Belt-and-suspenders: prove the response is JSON, not HTML.
    const contentType = res.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
  });

  test("authenticated API request after sign-in succeeds (control)", async ({ request }) => {
    // Sanity counter-test: the same endpoint returns 200 when authenticated.
    // This proves the 401 above was due to missing auth, not a broken endpoint.
    // Step 1 — acquire a real session cookie via the credentials provider.
    const csrfRes = await request.get(`${BASE_URL}/api/auth/csrf`);
    expect(csrfRes.ok()).toBe(true);
    const { csrfToken } = await csrfRes.json();

    const signInRes = await request.post(`${BASE_URL}/api/auth/callback/credentials`, {
      form: {
        email: DEMO_ADMIN_EMAIL,
        password: DEMO_ADMIN_PASSWORD,
        csrfToken,
        callbackUrl: "/en",
        json: "true",
      },
      maxRedirects: 0,
    });
    // next-auth returns 200 on successful credential callback (with redirect:false semantics).
    const signInStatus = signInRes.status();
    expect(signInStatus === 200 || signInStatus === 302).toBe(true);

    const usersRes = await request.get(`${BASE_URL}/api/identity/users`);
    expect(usersRes.status()).toBe(200);
    const body = await usersRes.json();
    expect(Array.isArray(body?.data)).toBe(true);

    // Belt-and-suspenders: prove the response is JSON, not HTML.
    const contentType: string = usersRes.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
  });
});
