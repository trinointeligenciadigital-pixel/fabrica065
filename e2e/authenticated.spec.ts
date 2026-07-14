import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("administrador acessa o diagnóstico e navega por teclado", async ({ page }) => {
  await page.goto("/diagnostico");
  await expect(page.getByRole("heading", { name: "Diagnóstico do sistema" })).toBeVisible();
  await expect(page.getByText("Nenhuma inconsistência crítica encontrada")).toBeVisible();

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Ir para o conteúdo principal" });
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
