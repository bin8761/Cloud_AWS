import { expect, test } from "@playwright/test";
import { authFixtures } from "./fixtures/auth.fixtures";
import { reissueFixtures } from "./fixtures/reissue.fixtures";
import { installMockApi } from "./support/mockApi";

async function login(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(authFixtures.loginInput.email);
  await page.getByLabel("Password").fill(authFixtures.loginInput.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

function visibleDetailPanel(page: import("@playwright/test").Page) {
  return page.locator("section[aria-label='Computer detail panel']:visible").first();
}

function visibleEditForm(page: import("@playwright/test").Page) {
  return page.locator("form[aria-label='Editable computer fields']:visible").first();
}

function visibleReissueForm(page: import("@playwright/test").Page) {
  return page.locator("#reissue-token-form:visible").first();
}

test("login success in browser", async ({ page }) => {
  await installMockApi(page);
  await login(page);
});

test("protected dashboard route redirects unauthenticated users", async ({ page }) => {
  await installMockApi(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Web Admin Login" })).toBeVisible();
});

test("dashboard KPI and realtime panel render", async ({ page }) => {
  await installMockApi(page);
  await login(page);
  await expect(page.getByLabel("Computer health KPI strip")).toBeVisible();
  await expect(page.getByText("Total Computers")).toBeVisible();
  await expect(page.getByLabel("Realtime panel")).toBeVisible();
  await expect(page.getByText("State:")).toBeVisible();
});

test("computers search, filter, sort, and pagination controls work", async ({ page }) => {
  await installMockApi(page);
  await login(page);
  await page.goto("/computers");

  await page.getByLabel("Search computers").fill("Workstation 01");
  await expect(page.getByRole("cell", { name: "Workstation 01" }).first()).toBeVisible();

  await page.getByLabel("Filter computers by status").selectOption("BLOCKED");
  await expect(page.getByRole("cell", { name: "Blocked" }).first()).toBeVisible();
  await page.getByLabel("Filter computers by status").selectOption("ALL");
  await page.getByLabel("Search computers").fill("");
  await page.waitForTimeout(400);
  await expect(page.getByText(/^Page 1 of \d+$/)).toBeVisible();

  await page.getByLabel("Sort computers").selectOption("createdAt:asc");
  await page.getByLabel("Select page size").selectOption("10");
  await page.getByRole("button", { name: "Go to next page" }).click();
  await expect(page.getByLabel("Computer list toolbar").getByText(/^Page 2 of \d+$/)).toBeVisible();
  await page.getByRole("button", { name: "Go to previous page" }).click();
  await expect(page.getByLabel("Computer list toolbar").getByText(/^Page 1 of \d+$/)).toBeVisible();
});

test("detail drawer opens on desktop", async ({ page }) => {
  await installMockApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.goto("/computers");
  await page.locator("div.hidden.md\\:block button[aria-label^='Open details for']").first().click();
  await expect(page.getByLabel("Computer detail panel").first()).toBeVisible();
});

test("detail sheet opens on mobile", async ({ page }) => {
  await installMockApi(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);
  await page.goto("/computers");
  await page.getByRole("button", { name: "Open details" }).first().click();
  await expect(visibleDetailPanel(page)).toBeVisible();
});

test("detail update success in browser", async ({ page }) => {
  await installMockApi(page);
  await login(page);
  await page.goto("/computers");
  await page.locator("div.hidden.md\\:block button[aria-label^='Open details for']").first().click();

  await visibleEditForm(page).getByPlaceholder("Computer display name").fill("Workstation Updated");
  await visibleEditForm(page).getByRole("button", { name: "Save changes" }).click();
  await expect(visibleEditForm(page).getByText("Update completed successfully.")).toBeVisible();
});

test("detail update rollback feedback in browser", async ({ page }) => {
  await installMockApi(page, { updateFailure: true });
  await login(page);
  await page.goto("/computers");
  await page.locator("div.hidden.md\\:block button[aria-label^='Open details for']").first().click();

  await visibleEditForm(page).getByRole("button", { name: "Save changes" }).click();
  await expect(
    visibleEditForm(page).getByText("Update failed and optimistic changes were rolled back. Please retry."),
  ).toBeVisible();
});

test("forbidden list keeps session and renders forbidden state", async ({ page }) => {
  await installMockApi(page, { forbiddenList: true });
  await login(page);
  await page.goto("/computers");
  await expect(page.getByText("Access to computer list is restricted")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out from web admin" })).toBeVisible();
});

test("rate-limited update shows dedicated feedback", async ({ page }) => {
  await installMockApi(page, { updateRateLimited: true });
  await login(page);
  await page.goto("/computers");
  await page.locator("div.hidden.md\\:block button[aria-label^='Open details for']").first().click();
  await visibleEditForm(page).getByRole("button", { name: "Save changes" }).click();
  await expect(
    visibleEditForm(page).getByText("Too many update attempts. Please wait a moment and try again."),
  ).toBeVisible();
});

test("reissue token reveal, copy action, and clear-on-close", async ({ page, context }) => {
  await installMockApi(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page);
  await page.goto("/computers");
  await page.locator("div.hidden.md\\:block button[aria-label^='Open details for']").first().click();

  await visibleEditForm(page).getByRole("button", { name: "Reissue token" }).click();
  await visibleReissueForm(page).getByPlaceholder("Example: Client PC was reinstalled").fill(reissueFixtures.reason);
  await page.locator("button:visible", { hasText: "Confirm reissue" }).click();
  await expect(visibleReissueForm(page).getByText(reissueFixtures.plainToken)).toBeVisible();

  await visibleReissueForm(page).getByRole("button", { name: "Copy one-time device token" }).click();
  await expect(visibleReissueForm(page).getByText("Token copied to clipboard.")).toBeVisible();

  await page.locator("button:visible", { hasText: "Cancel" }).click();
  await visibleEditForm(page).getByRole("button", { name: "Reissue token" }).click();
  await expect(visibleReissueForm(page).getByText(reissueFixtures.plainToken)).toHaveCount(0);
});

test("desktop, laptop, tablet, and mobile breakpoints render without horizontal scroll", async ({ page }) => {
  await installMockApi(page);
  await login(page);
  await page.goto("/computers");

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("complementary", { name: "Sidebar" })).toBeVisible();

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.getByLabel("Topbar")).toBeVisible();

  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.getByLabel("Topbar")).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByLabel("Computers mobile card list")).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth;
  });
  expect(hasHorizontalOverflow).toBe(false);
});

test("keyboard focus order on login page", async ({ page }) => {
  await installMockApi(page);
  await page.goto("/login");

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Sign In" })).toBeFocused();
});

test("keyboard focus order in shell navigation and filters", async ({ page }) => {
  await installMockApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.goto("/computers");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Computers" })).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Log out from web admin" })).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Search computers")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Filter computers by status")).toBeFocused();
});

test("keyboard focus order in drawer and reissue modal", async ({ page }) => {
  await installMockApi(page);
  await login(page);
  await page.goto("/computers");
  await page.locator("div.hidden.md\\:block button[aria-label^='Open details for']").first().click();

  await page.keyboard.press("Tab");
  await expect(visibleEditForm(page).getByPlaceholder("Computer display name")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(visibleEditForm(page).getByRole("combobox").first()).toBeFocused();

  await visibleEditForm(page).getByRole("button", { name: "Reissue token" }).click();
  await page.keyboard.press("Tab");
  await expect(visibleReissueForm(page).getByPlaceholder("Example: Client PC was reinstalled")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("button:visible", { hasText: "Cancel" })).toBeFocused();
});

test("visible focus ring appears on keyboard focus", async ({ page }) => {
  await installMockApi(page);
  await page.goto("/login");
  await page.keyboard.press("Tab");

  const boxShadow = await page.getByLabel("Email").evaluate((element) => {
    return window.getComputedStyle(element).boxShadow;
  });
  expect(boxShadow).not.toBe("none");
});

test("long token wraps and copy button stays visible", async ({ page }) => {
  await installMockApi(page, { reissueLongToken: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);
  await page.goto("/computers");

  await page.getByRole("button", { name: "Open details" }).first().click();
  await visibleEditForm(page).getByRole("button", { name: "Reissue token" }).click();
  await visibleReissueForm(page).getByPlaceholder("Example: Client PC was reinstalled").fill(reissueFixtures.reason);
  await page.locator("button:visible", { hasText: "Confirm reissue" }).click();

  await expect(visibleReissueForm(page).getByRole("button", { name: "Copy one-time device token" })).toBeVisible();
  const tokenContainer = visibleReissueForm(page).locator("section:has-text('New one-time token') div").nth(1);
  const overflowed = await tokenContainer.evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(overflowed).toBe(false);
});
