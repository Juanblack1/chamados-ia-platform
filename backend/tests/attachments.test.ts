import { describe, expect, it } from "vitest";
import { summarizeTicketInputForLlm } from "../src/ai/agents/attachmentSummary.js";
import {
  AttachmentValidationError,
  MemoryTicketAttachmentStore,
  finalizeTicketAttachments,
  prepareTicketAttachments
} from "../src/domain/attachmentStore.js";
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

  it("stores scanned image attachments outside the ticket payload", async () => {
    const store = new MemoryTicketAttachmentStore();
    const prepared = await prepareTicketAttachments(store, [imageDataUrl], "usr-requester");

    expect(prepared.attachments[0]).toMatch(/^attachment:\/\/pending\//);
    expect(prepared.attachments[0]).not.toContain("iVBORw0KGgo");

    const finalized = await finalizeTicketAttachments(store, "ticket-1", prepared);
    expect(finalized[0]).toMatch(/^\/api\/tickets\/ticket-1\/attachments\//);

    const attachmentId = finalized[0].split("/").pop();
    expect(attachmentId).toBeTruthy();
    const stored = await store.get("ticket-1", attachmentId ?? "");
    expect(stored?.contentType).toBe("image/png");
    expect(stored?.scan.status).toBe("clean");
    expect(stored?.content.toString("base64")).toContain("iVBORw0KGgo");
  });

  it("rejects image payloads whose binary signature does not match the declared type", async () => {
    const store = new MemoryTicketAttachmentStore();
    const executableAsImage = `data:image/png;base64,${Buffer.from("MZ fake executable").toString("base64")}`;

    await expect(prepareTicketAttachments(store, [executableAsImage], "usr-requester")).rejects.toBeInstanceOf(
      AttachmentValidationError
    );
  });
});
