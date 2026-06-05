import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import type { CreateTicketInput, RagSource, TicketPriority } from "../../domain/ticket.js";
import type { ModelGateway } from "../modelGateway.js";
import { summarizeTicketInputForLlm } from "./attachmentSummary.js";

const TriageResultSchema = z.object({
  category: z.string(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  slaClass: z.string(),
  tags: z.array(z.string()),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  missingInformation: z.array(z.string())
});

export type TriageResult = z.infer<typeof TriageResultSchema>;

export class TicketTriageAgent {
  private readonly prompt = ChatPromptTemplate.fromMessages([
    ["system", "Classifique chamados corporativos de service desk. Retorne JSON compacto em pt-BR."],
    ["human", "{ticket}\n\nRetrieved evidence:\n{sources}"]
  ]);

  constructor(private readonly llm: ModelGateway) {}

  modelRoute(): string {
    return this.llm.routeLabel;
  }

  executionMode(): "model-cascade" | "deterministic-fallback" {
    return this.llm.executionMode;
  }

  async run(input: CreateTicketInput, sources: RagSource[]): Promise<TriageResult> {
    const rendered = await this.prompt.format({
      ticket: JSON.stringify(summarizeTicketInputForLlm(input), null, 2),
      sources: JSON.stringify(sources, null, 2)
    });

    const result = await this.llm.completeObject({
      system: "Classifique categoria, prioridade, SLA, tags, informacoes faltantes, confianca e resumo em uma frase. Todos os textos de resposta devem estar em pt-BR.",
      user: rendered,
      schema: TriageResultSchema,
      fallback: () => fallbackTriage(input)
    });

    return TriageResultSchema.parse(result);
  }
}

function fallbackTriage(input: CreateTicketInput): TriageResult {
  const text = `${input.title} ${input.description} ${input.businessImpact}`.toLowerCase();
  const priority = classifyPriority(text, input.urgency);
  const category = classifyCategory(text, input.affectedService);

  return {
    category,
    priority,
    slaClass: priority === "critical" ? "P1 - 15 min" : priority === "high" ? "P2 - 1 hora" : "P3 - dia util",
    tags: [category.toLowerCase().replace(/\s+/g, "-"), priority, input.affectedService.toLowerCase().replace(/\s+/g, "-")],
    summary: `Chamado classificado como ${category} com prioridade ${priorityLabel(priority)}.`,
    confidence: text.length > 120 ? 0.86 : 0.62,
    missingInformation: text.length > 120 ? [] : ["Informe a mensagem de erro, o horario de inicio e os usuarios afetados."]
  };
}

function priorityLabel(priority: TicketPriority): string {
  if (priority === "critical") return "critica";
  if (priority === "high") return "alta";
  if (priority === "medium") return "media";
  return "baixa";
}

function classifyPriority(text: string, urgency: TicketPriority): TicketPriority {
  if (urgency === "critical") return "critical";
  if (/(faturamento|revenue|seguranca|security|parado|indisponivel|bloqueado|critical)/.test(text)) return "critical";
  if (/(alto|high|degradado|sla|clientes|vpn)/.test(text)) return "high";
  if (/(duvida|acesso individual|solicitacao)/.test(text)) return "low";
  return urgency;
}

function classifyCategory(text: string, affectedService: string): string {
  if (/(vpn|rede|network|latencia|conexao)/.test(text)) return "Rede";
  if (/(senha|mfa|acesso|identity|login)/.test(text)) return "Acesso e identidade";
  if (/(erp|faturamento|nota|invoice|financeiro)/.test(text)) return "ERP";
  if (/(api|endpoint|webhook|integracao|integration|http|500|timeout)/.test(text)) return "APIs e integracoes";
  if (/(hardware|notebook|computador|impressora|monitor|patrimonio|serial)/.test(text)) return "Hardware";
  if (/(aprovacao|aprovar|compras|orcamento|centro de custo|acesso privilegiado)/.test(text)) return "Aprovacoes";
  return affectedService;
}
