import { expect, test } from "@playwright/test";

test("shows the starter app shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "seat-picker" })).toBeVisible();
  await expect(page.getByText("좌석 설정")).toBeVisible();
});
