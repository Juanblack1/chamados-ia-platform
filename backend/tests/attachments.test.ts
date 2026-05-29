import { describe, expect, it } from "vitest";
import { summarizeTicketInputForLlm } from "../src/ai/agents/attachmentSummary.js";
import { CreateTicketInputSchema } from "../src/domain/ticket.js";

const imageDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

describe("ticket attachments", () => {
  it("accepts image data URLs and removes binary data from LLM prompts", () => {
    const input = CreateTicketInputSchema.parse({
      requesterEmail: "ana@acme.local",
      department: "Financeiro",
      title: "Erro visual no ERP",
      description: "Tela do ERP mostra erro ao confirmar um lote fiscal com evidencia em imagem.",
      affectedService: "ERP Central",
      urgency: "high",
      businessImpact: "Analista nao consegue confirmar o lote fiscal.",
      attachments: [imageDataUrl]
    });

    expect(input.attachments).toEqual([imageDataUrl]);

    const summarized = summarizeTicketInputForLlm(input);
    expect(summarized.attachments[0]).toContain("image/png attachment 1");
    expect(summarized.attachments[0]).not.toContain("iVBORw0KGgo");
  });
});
