import { expect, test } from "@playwright/test";

test("requester blocks weak intake, opens a complete ticket, and sees only own queue", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("E-mail corporativo").fill("solicitante.teste@empresa.local");
  await page.getByLabel("Senha").fill("dev123");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByRole("heading", { name: "Meus chamados" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir chamado" }).first().click();

  const form = page.locator("form.intake-layout");
  await form.getByLabel("Titulo").fill("Problema urgente");
  await form.getByLabel("Descricao").fill("Nao funciona direito desde ontem e preciso de ajuda.");
  await form.getByLabel("Impacto no negocio").fill("Nao sei.");
  await form.getByRole("button", { name: "Analisar chamado" }).click();

  await expect(page.getByRole("heading", { name: "Faltando para abrir" })).toBeVisible();
  await expect(form.getByRole("button", { name: "Criar chamado" })).toBeDisabled();

  await form.getByLabel("Servico afetado").selectOption("ERP Central");
  await form.getByLabel("Titulo").fill("Faturamento bloqueado no ERP");
  await form
    .getByLabel("Descricao")
    .fill("O lote de faturamento do ERP falhou com erro FIS-103 desde 09:00 para a filial SP.");
  await form.getByLabel("Urgencia").selectOption("critical");
  await form.getByLabel("Impacto operacional").selectOption("critical");
  await form.getByLabel("Impacto no negocio").fill("Fechamento mensal parado para a filial SP.");
  await form.getByRole("button", { name: "Criar chamado" }).click();

  await expect(page.getByRole("heading", { name: "Faturamento bloqueado no ERP" })).toBeVisible();
  await page.getByRole("button", { name: "Meus chamados" }).click();
  await expect(page.getByRole("cell", { name: "Faturamento bloqueado no ERP" })).toBeVisible();
  await expect(page.getByText("maria.silva@acme.local")).toHaveCount(0);
});
