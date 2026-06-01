import { calculatePriority, selectGroup } from "../../domain/serviceDeskCatalog.js";
import type { CreateTicketInput, RagSource, Ticket, TicketPriority, TicketType } from "../../domain/ticket.js";
import type { TriageResult } from "./TicketTriageAgent.js";

export type IntakeReadiness = "ready" | "needs_info" | "self_service";

export type IntakeQualitySignal = {
  label: string;
  status: "ok" | "warning" | "missing";
  detail: string;
};

export type IntakeSimilarTicket = {
  id: string;
  number: string;
  title: string;
  status: string;
  priority: TicketPriority;
  affectedService: string;
  score: number;
};

export type IntakeAssessment = {
  readiness: IntakeReadiness;
  shouldCreate: boolean;
  qualityScore: number;
  summary: string;
  blockedReason?: string;
  detectedIntent: string;
  sentiment: "neutral" | "negative" | "urgent";
  language: "pt-BR" | "en" | "unknown";
  missingInformation: string[];
  clarificationQuestions: string[];
  qualitySignals: IntakeQualitySignal[];
  suggestedFields: {
    type: TicketType;
    category: string;
    priority: TicketPriority;
    urgency: TicketPriority;
    impact: TicketPriority;
    affectedService: string;
    assignedGroupId: string;
    assignedGroupName: string;
    tags: string[];
    title?: string;
  };
  selfService: {
    canDeflect: boolean;
    confidence: number;
    answer: string;
    sources: RagSource[];
  };
  ragSources: RagSource[];
  similarTickets: IntakeSimilarTicket[];
  workflow: string[];
};

export function assessTicketIntakeQuality(params: {
  input: CreateTicketInput;
  triage: TriageResult;
  sources: RagSource[];
  existingTickets: Ticket[];
}): IntakeAssessment {
  const { input, triage, sources, existingTickets } = params;
  const text = normalize(`${input.title} ${input.description} ${input.businessImpact}`);
  const relevantSources = filterRelevantSources(input, sources, text);
  const unknownService = isUnknownService(input.affectedService);
  const genericDescription = isGenericDescription(input.description);
  const genericImpact = isGenericImpact(input.businessImpact);
  const details = {
    hasMeaningfulTitle: wordCount(input.title) >= 3 && normalize(input.title).length >= 10,
    hasDetailedDescription: (wordCount(input.description) >= 12 || normalize(input.description).length >= 80) && !genericDescription,
    hasBusinessImpact:
      normalize(input.businessImpact).length >= 20 &&
      !genericImpact &&
      /(parad|bloquead|indisponivel|atras|fila|fatur|pagamento|pedido|cliente|usuario|equipe|filial|operacao|financeiro|seguranca|compliance|\d+)/.test(
        normalize(input.businessImpact)
      ),
    hasService: normalize(input.affectedService).length >= 3 && !unknownService,
    hasTimeWindow: /(desde|hoje|ontem|agora|manha|tarde|noite|\d{1,2}:\d{2}|\d+\s?(min|hora|horas|dia|dias))/.test(text),
    hasAffectedUsers: /(usuario|usuarios|pessoa|pessoas|equipe|time|setor|departamento|filial|todos|cliente|clientes|\d+\s?(user|usuarios|pessoas))/.test(text),
    hasObservedError: /(erro|falha|codigo|http|timeout|lento|indisponivel|bloqueado|nao abre|nao carrega|print|anexo|mensagem|log)/.test(text),
    hasAttemptedAction: /(tentei|testei|reiniciei|limpei|validei|verifiquei|sem workaround|contorno|workaround|reproduzi)/.test(text),
    hasEvidence: input.attachments.length > 0 || /(print|screenshot|log|evidencia|anexo)/.test(text)
  };
  const nonsense = isNonsense(input);
  const genericVague = isGenericVagueIntake(input, details, unknownService);
  const missingInformation = dedupe([
    ...triage.missingInformation.map(normalizeMissingInformation),
    ...buildMissingInformation(details, input)
  ]).slice(0, 8);
  const score = calculateQualityScore(details, relevantSources, nonsense || genericVague, missingInformation.length);
  const suggestedPriority = calculatePriority(input.urgency, input.impact);
  const group = selectGroup(input);
  const similarTickets = findSimilarTickets(input, existingTickets);
  const selfService = buildSelfServiceSuggestion(input, relevantSources, suggestedPriority, text);
  const hardBlock = nonsense || genericVague || score < 55 || missingInformation.length >= 5;
  const shouldCreate = !hardBlock && !selfService.canDeflect;
  const readiness: IntakeReadiness = hardBlock ? "needs_info" : selfService.canDeflect ? "self_service" : "ready";
  const titleSuggestion = suggestTitle(input, triage.category);

  return {
    readiness,
    shouldCreate,
    qualityScore: score,
    summary: buildSummary(readiness, score, triage, group.name, selfService.canDeflect),
    blockedReason: hardBlock ? "Inclua contexto suficiente para a triagem antes de criar o chamado." : undefined,
    detectedIntent: triage.category,
    sentiment: detectSentiment(text),
    language: detectLanguage(text),
    missingInformation,
    clarificationQuestions: buildClarificationQuestions(missingInformation, input).slice(0, 5),
    qualitySignals: buildQualitySignals(details, nonsense || genericVague),
    suggestedFields: {
      type: input.type,
      category: triage.category,
      priority: triage.priority === "critical" ? "critical" : suggestedPriority,
      urgency: input.urgency,
      impact: input.impact,
      affectedService: input.affectedService,
      assignedGroupId: group.id,
      assignedGroupName: group.name,
      tags: dedupe([...triage.tags, readiness === "self_service" ? "self-service-candidate" : "intake-validated"]),
      title: titleSuggestion
    },
    selfService,
    ragSources: relevantSources,
    similarTickets,
    workflow: [
      "ticket.intake-assessment",
      "agent.intake-quality",
      "agent.rag-retrieval",
      "rag.search",
      "agent.ticket-triage",
      "agent.routing",
      readiness === "ready" ? "ticket.ready-to-open" : "ticket.blocked-before-open"
    ]
  };
}

function filterRelevantSources(input: CreateTicketInput, sources: RagSource[], normalizedText: string): RagSource[] {
  const queryTerms = extractRelevantTerms(`${normalizedText} ${normalize(input.affectedService)}`);

  return sources.filter((source) => {
    const sourceText = normalize(`${source.title} ${source.source} ${source.excerpt}`);
    const sourceTerms = extractRelevantTerms(sourceText);
    const overlap = [...queryTerms].filter((term) => sourceTerms.has(term)).length;
    const serviceMatch = serviceTerms(input.affectedService).some((term) => sourceText.includes(term));
    const enoughLexicalSignal = overlap >= 2 || (overlap >= 1 && queryTerms.size <= 4) || serviceMatch;
    return source.relevance >= 0.72 && enoughLexicalSignal;
  });
}

function extractRelevantTerms(text: string): Set<string> {
  const stopwords = new Set([
    "com",
    "para",
    "por",
    "que",
    "uma",
    "das",
    "dos",
    "esta",
    "este",
    "isso",
    "nao",
    "preciso",
    "ajuda",
    "problema",
    "urgente",
    "geral",
    "chamado",
    "funciona",
    "ruim"
  ]);
  return new Set(
    normalize(text)
      .split(/\W+/)
      .filter((term) => term.length >= 4 && !stopwords.has(term))
  );
}

function serviceTerms(affectedService: string): string[] {
  const service = normalize(affectedService);
  if (/erp|faturamento|fiscal|nota/.test(service)) return ["erp", "fatur", "fiscal", "nota", "invoice", "billing"];
  if (/rede|vpn|wi-fi|wifi|conexao/.test(service)) return ["rede", "vpn", "network", "conexao", "packet", "latencia"];
  if (/identity|acesso|senha|mfa|login|sso/.test(service)) return ["identity", "acesso", "senha", "mfa", "login", "sso"];
  if (/api|integracao|plataforma/.test(service)) return ["api", "integracao", "plataforma"];
  return [];
}

function normalizeMissingInformation(item: string): string {
  const normalized = normalize(item);
  if (/error message|time window|affected users/.test(normalized)) {
    return "Informe a mensagem de erro, o horario de inicio e os usuarios afetados.";
  }
  if (/system|application|service/.test(normalized)) return "Informe o sistema, aplicacao ou servico afetado.";
  if (/business impact|impact/.test(normalized)) return "Informe o impacto no negocio, area afetada ou processo parado.";
  return item;
}

function calculateQualityScore(
  details: Record<string, boolean>,
  sources: RagSource[],
  nonsense: boolean,
  missingCount: number
): number {
  if (nonsense) return 20;

  const weights: Array<[keyof typeof details, number]> = [
    ["hasMeaningfulTitle", 10],
    ["hasDetailedDescription", 20],
    ["hasBusinessImpact", 15],
    ["hasService", 10],
    ["hasTimeWindow", 10],
    ["hasAffectedUsers", 10],
    ["hasObservedError", 10],
    ["hasAttemptedAction", 5],
    ["hasEvidence", 5]
  ];
  const base = weights.reduce((sum, [key, weight]) => sum + (details[key] ? weight : 0), 5);
  const ragBonus = sources.length > 0 ? 5 : 0;
  return clamp(base + ragBonus - Math.max(0, missingCount - 2) * 4, 0, 100);
}

function buildMissingInformation(details: Record<string, boolean>, input: CreateTicketInput): string[] {
  const missing: string[] = [];
  if (!details.hasService) missing.push("Informe o sistema, aplicacao ou servico afetado.");
  if (!details.hasDetailedDescription) missing.push("Descreva o sintoma observado, quando ocorre e como reproduzir.");
  if (!details.hasBusinessImpact) missing.push("Informe o impacto no negocio, area afetada ou processo parado.");
  if (!details.hasTimeWindow) missing.push("Informe desde quando ocorre ou o horario da primeira ocorrencia.");
  if (!details.hasAffectedUsers) missing.push("Informe quantos usuarios, clientes, filiais ou equipes foram afetados.");
  if (!details.hasObservedError && input.type === "incident") missing.push("Inclua mensagem de erro, codigo, print ou comportamento observado.");
  if (!details.hasAttemptedAction) missing.push("Informe o que ja foi tentado ou se nao ha workaround.");
  return missing;
}

function buildClarificationQuestions(missingInformation: string[], input: CreateTicketInput): string[] {
  const questions = missingInformation.map((item) => {
    if (item.includes("sintoma")) return "Qual sintoma aparece e quais passos reproduzem o problema?";
    if (item.includes("impacto")) return "Qual processo de negocio esta parado ou degradado?";
    if (item.includes("desde")) return "Desde quando isso acontece?";
    if (item.includes("quantos")) return "Quantas pessoas, equipes ou clientes foram afetados?";
    if (item.includes("mensagem")) return "Qual mensagem de erro, codigo ou evidencia aparece?";
    if (item.includes("tentado")) return "O que ja foi tentado e existe algum workaround?";
    return item;
  });

  if (input.type === "request") questions.push("Qual aprovador ou regra autoriza esta solicitacao?");
  return dedupe(questions);
}

function buildQualitySignals(details: Record<string, boolean>, nonsense: boolean): IntakeQualitySignal[] {
  if (nonsense) {
    return [
      {
        label: "Conteudo",
        status: "missing",
        detail: "Texto generico ou sem informacao operacional."
      }
    ];
  }

  return [
    signal("Titulo", details.hasMeaningfulTitle, "Titulo identifica o servico e o sintoma."),
    signal("Descricao", details.hasDetailedDescription, "Descricao traz contexto para triagem."),
    signal("Impacto", details.hasBusinessImpact, "Impacto de negocio informado."),
    signal("Janela", details.hasTimeWindow, "Horario ou periodo informado."),
    signal("Afetados", details.hasAffectedUsers, "Escopo de usuarios ou area informado."),
    signal("Evidencia", details.hasObservedError || details.hasEvidence, "Erro, print, log ou comportamento observado.")
  ];
}

function signal(label: string, ok: boolean, detail: string): IntakeQualitySignal {
  return {
    label,
    status: ok ? "ok" : "missing",
    detail
  };
}

function buildSelfServiceSuggestion(
  input: CreateTicketInput,
  sources: RagSource[],
  priority: TicketPriority,
  normalizedText: string
): IntakeAssessment["selfService"] {
  const topSource = sources[0];
  const asksForHowTo = /(como|qual procedimento|passo a passo|preciso saber|duvida|orientacao)/.test(normalizedText);
  const lowOperationalRisk = priority === "low" || (priority === "medium" && input.impact !== "high" && input.urgency !== "high");
  const canDeflect = Boolean(topSource && topSource.relevance >= 0.82 && asksForHowTo && lowOperationalRisk);

  return {
    canDeflect,
    confidence: topSource ? Math.min(0.98, topSource.relevance) : 0,
    answer: topSource
      ? `Antes de abrir o chamado, consulte "${topSource.title}". ${topSource.excerpt}`
      : "Nenhum artigo forte foi encontrado para autoatendimento.",
    sources: sources.slice(0, 3)
  };
}

function findSimilarTickets(input: CreateTicketInput, tickets: Ticket[]): IntakeSimilarTicket[] {
  const inputTokens = tokenize(`${input.title} ${input.description} ${input.affectedService}`);
  return tickets
    .map((ticket) => {
      const score =
        jaccard(inputTokens, tokenize(`${ticket.title} ${ticket.description} ${ticket.affectedService}`)) +
        (normalize(ticket.affectedService) === normalize(input.affectedService) ? 0.28 : 0) +
        (ticket.status !== "closed" && ticket.status !== "resolved" ? 0.08 : 0);

      return {
        id: ticket.id,
        number: ticket.number,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        affectedService: ticket.affectedService,
        score: Math.min(1, Number(score.toFixed(2)))
      };
    })
    .filter((ticket) => ticket.score >= 0.22)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function suggestTitle(input: CreateTicketInput, category: string): string | undefined {
  if (wordCount(input.title) >= 5) return undefined;
  const service = input.affectedService || category;
  const symptom = input.description.split(/[.!?]/)[0]?.trim();
  if (!symptom || symptom.length < 12) return undefined;
  return `${service}: ${symptom}`.slice(0, 120);
}

function buildSummary(
  readiness: IntakeReadiness,
  score: number,
  triage: TriageResult,
  groupName: string,
  canDeflect: boolean
): string {
  if (readiness === "needs_info") return `Intake incompleto (${score}/100). Colete mais contexto antes de abrir o chamado.`;
  if (canDeflect) return `Possivel autoatendimento com base de conhecimento antes de abrir chamado.`;
  return `Intake pronto (${score}/100). Previsao: ${triage.category}, prioridade ${triage.priority}, grupo ${groupName}.`;
}

function detectSentiment(text: string): IntakeAssessment["sentiment"] {
  if (/(urgente|critico|critica|parado|bloqueado|indisponivel|sem faturar|seguranca|compliance)/.test(text)) return "urgent";
  if (/(erro|falha|nao funciona|problema|lento|perda|queda)/.test(text)) return "negative";
  return "neutral";
}

function detectLanguage(text: string): IntakeAssessment["language"] {
  if (/\b(the|and|with|error|issue|please|user)\b/.test(text)) return "en";
  if (/\b(nao|com|para|erro|usuario|chamado|acesso|desde|impacto)\b/.test(text)) return "pt-BR";
  return "unknown";
}

function isNonsense(input: CreateTicketInput): boolean {
  const text = normalize(`${input.title} ${input.description} ${input.businessImpact}`);
  const compact = text.replace(/\s+/g, "");
  const tokens = tokenize(text);
  if (compact.length < 24) return true;
  if (/^(teste|test|asdf|qwerty|abc|123|na|n\/a|xxx)+$/.test(compact)) return true;
  if (tokens.length < 5) return true;
  if (new Set(tokens).size <= 3) return true;
  return /^(problema|erro|nao funciona|ajuda|urgente)\s*(problema|erro|nao funciona|ajuda|urgente)?$/.test(text);
}

function isUnknownService(value: string): boolean {
  const service = normalize(value);
  return /^(geral|outro|outros|nao sei|nao definido|indefinido|n\/a|sem servico|sem sistema|nao informado)$/.test(service);
}

function isGenericDescription(value: string): boolean {
  const description = normalize(value);
  return /(nao sei explicar|nao consigo explicar|sem detalhes|nao sei informar|preciso de ajuda|me ajuda|nao funciona direito|problema urgente)/.test(
    description
  );
}

function isGenericImpact(value: string): boolean {
  const impact = normalize(value);
  return /(nao informado|n\/a|sem impacto|nao sei|preciso de ajuda|nao informei impacto|impacto operacional concreto|sem detalhe)/.test(impact);
}

function isGenericVagueIntake(input: CreateTicketInput, details: Record<string, boolean>, unknownService: boolean): boolean {
  const text = normalize(`${input.title} ${input.description} ${input.businessImpact}`);
  const genericPhrase = /(sem detalhes|nao sei explicar|nao consigo explicar|nao sei informar|preciso de ajuda|nao funciona direito|problema urgente)/.test(text);
  const missingOperationalCore = !details.hasService || !details.hasBusinessImpact || (!details.hasObservedError && !details.hasAffectedUsers);
  return genericPhrase && (unknownService || missingOperationalCore);
}

function wordCount(value: string): number {
  return tokenize(value).length;
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3)
    .filter((token) => !["para", "com", "uma", "por", "dos", "das", "the", "and"].includes(token));
}

function jaccard(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) return 0;
  const a = new Set(left);
  const b = new Set(right);
  const intersection = [...a].filter((item) => b.has(item)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
