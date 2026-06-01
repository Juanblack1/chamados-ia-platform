import { expect, test } from "@playwright/test";

test("requester blocks weak intake, opens a complete ticket, and sees only own queue", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("E-mail corporativo").fill("solicitante.teste@empresa.local");
  await page.getByLabel("Senha").fill("dev123");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByRole("heading", { name: "Meus chamados" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir chamado" }).first().click();

  const form = page.locator("form.intake-layout");
  await form.getByLabel("Descricao").fill("Nao funciona direito desde ontem e preciso de ajuda.");
  await form.getByRole("button", { name: "Analisar chamado" }).click();

  await expect(page.getByRole("heading", { name: "Faltando para abrir" })).toBeVisible();
  await expect(form.getByRole("button", { name: "Criar chamado" })).toBeDisabled();

  await form
    .getByLabel("Descricao")
    .fill("O lote de faturamento do ERP falhou com erro FIS-103 desde 09:00 para a filial SP, bloqueando o fechamento mensal do financeiro.");
  await form.getByRole("button", { name: "Criar chamado" }).click();

  await expect(page.getByRole("heading", { name: /ERP Central|faturamento/i })).toBeVisible();
  await page.getByRole("button", { name: "Meus chamados" }).click();
  await expect(page.getByText(/ERP Central|faturamento/i).first()).toBeVisible();
  await page.locator(".ticket-table-row").first().locator('[data-label="Status"]').click();
  await expect(page.getByRole("heading", { name: /ERP Central|faturamento/i })).toBeVisible();
  await page.getByRole("button", { name: "Meus chamados" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".ticket-table-row").first()).toBeVisible();
  await expect(page.getByText("maria.silva@acme.local")).toHaveCount(0);
  await expect
    .poll(async () =>
      page.locator(".ticket-table-wrap").evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
    )
    .toBe(true);
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test("admin manages users and opens the treatment workspace responsively", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("E-mail corporativo").fill("admin@empresa.local");
  await page.getByLabel("Senha").fill("admin123");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByRole("heading", { name: "Minha fila" })).toBeVisible();
  await page.getByRole("button", { name: "Usuarios" }).click();

  await expect(page.getByRole("heading", { name: "Diretorio" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Novo usuario" })).toBeVisible();
  await expect(page.getByText("admin@empresa.local")).toBeVisible();

  await page.getByRole("button", { name: "Novo usuario" }).click();
  const form = page.locator("form.user-create-form");
  await form.getByLabel("Nome").fill("Analista E2E");
  await form.getByLabel("E-mail").fill("analista.e2e@empresa.local");
  await form.getByLabel("Senha inicial").fill("Admin123!");
  await form.getByRole("button", { name: "Criar usuario" }).click();
  await expect(page.getByText("analista.e2e@empresa.local")).toBeVisible();

  await page.getByRole("button", { name: "Minha fila" }).click();
  await page.locator(".ticket-table-row").first().click();
  await expect(page.getByRole("heading", { name: "Tratamento" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Contexto da IA" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Acompanhamentos" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});
