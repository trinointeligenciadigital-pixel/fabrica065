import { mkdir } from "node:fs/promises";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

setup.describe.configure({ mode: "serial" });

setup("autentica o administrador de teste", async ({ page }) => {
  await clerkSetup();
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: process.env.E2E_ADMIN_EMAIL! });
  await mkdir("playwright/.clerk", { recursive: true });
  await page.context().storageState({ path: "playwright/.clerk/admin.json" });
});
