import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("protege a área administrativa sem uma sessão Clerk", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Entre para gerenciar o estoque" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar com Clerk" })).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("recusa um QR inexistente sem revelar dados da operação", async ({ page }) => {
  await page.goto("/operacao/token-inexistente-e2e");
  await expect(page.getByRole("heading", { name: "QR inválido ou inativo" })).toBeVisible();
  await expect(page.getByText("Solicite ao responsável um novo código de acesso")).toBeVisible();
  await expect(page.getByText("PIN", { exact: false })).toHaveCount(0);
});

test("mantém o fluxo público dentro da largura de um celular", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/operacao/token-inexistente-e2e");
  await expect(page.getByRole("heading", { name: "QR inválido ou inativo" })).toBeVisible();
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflows).toBe(false);
});
