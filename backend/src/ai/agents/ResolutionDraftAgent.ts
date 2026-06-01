import { z } from "zod";
import type { CreateTicketInput, RagSource } from "../../domain/ticket.js";
import type { ModelGateway } from "../modelGateway.js";
import { summarizeTicketInputForLlm } from "./attachmentSummary.js";
import type { TriageResult } from "./TicketTriageAgent.js";

const ResolutionDraftSchema = z.object({
  response: z.string(),
  nextActions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string())
});

export type ResolutionDraft = z.infer<typeof ResolutionDraftSchema>;

export class ResolutionDraftAgent {
  constructor(private readonly llm: ModelGateway) {}

  async run(input: CreateTicketInput, triage: TriageResult, sources: RagSource[]): Promise<ResolutionDraft> {
    const result = await this.llm.completeObject({
      system:
        "Redija em portugues do Brasil uma primeira resposta objetiva para o analista de service desk. Cite apenas IDs de fontes fornecidas e evite afirmacoes sem evidencia. Nunca responda em ingles.",
      user: JSON.stringify({ input: summarizeTicketInputForLlm(input), triage, sources }, null, 2),
      schema: ResolutionDraftSchema,
      fallback: () => fallbackDraft(input, triage, sources)
    });

    return ResolutionDraftSchema.parse(result);
  }
}

function fallbackDraft(input: CreateTicketInput, triage: TriageResult, sources: RagSource[]): ResolutionDraft {
  return {
    response: `Chamado recebido e classificado como ${triage.category}. Vou validar ${input.affectedService}, confirmar o impacto informado e seguir o runbook aplicavel antes de escalar.`,
    nextActions: [
      "Confirmar quantidade de usuarios afetados",
      "Validar sinais do servico afetado",
      "Aplicar runbook sugerido pelo artigo de conhecimento"
    ],
    confidence: Math.min(0.9, triage.confidence),
    evidence: sources.map((source) => source.id)
  };
}
