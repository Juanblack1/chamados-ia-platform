import { useMemo } from "react";
import {
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import type { AgentAuditEntry, ServiceDeskCatalog, ServiceDeskEvalReport, Ticket, TraceSpan } from "../../lib/api";
import { priorityLabel, priorityTone, statusLabel, statusTone } from "../../lib/presentation";
import { Badge, SkeletonRows, SlaBadge } from "../../components/common";
import {
  buildGovernanceModel,
  evalCaseDetail,
  evalCaseTitle,
  evalReportTone,
  feedbackDecisionLabel,
  feedbackRatingLabel,
  feedbackRatingTone,
  formatDate,
  formatDateTime,
  recommendationLabel,
  recommendationTone
} from "./governanceModel";

export function GovernanceView({
  tickets,
  traces,
  agentRuns,
  evalReport,
  catalog,
  isLoading,
  onOpenTicket
}: {
  tickets: Ticket[];
  traces: TraceSpan[];
  agentRuns: AgentAuditEntry[];
  evalReport: ServiceDeskEvalReport | null;
  catalog: ServiceDeskCatalog | null;
  isLoading: boolean;
  onOpenTicket: (ticket: Ticket) => void;
}) {
  const model = useMemo(() => buildGovernanceModel(tickets, traces, agentRuns, catalog), [tickets, traces, agentRuns, catalog]);

  if (isLoading) {
    return (
      <section className="governance-layout" aria-label="Governanca da IA">
        <SkeletonRows />
      </section>
    );
  }

  return (
    <section className="governance-layout" aria-label="Governanca da IA">
      <div className="governance-hero panel">
        <div>
          <p className="eyebrow">Loop de melhoria continua</p>
          <h2>Governanca IA</h2>
          <p>Riscos, rastreio e recomendacoes geradas a partir dos chamados autorizados.</p>
        </div>
        <Badge tone={model.overallTone}>{model.overallLabel}</Badge>
      </div>

      <div className="governance-metrics" aria-label="Indicadores de governanca">
        {model.metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className={`governance-metric ${metric.tone}`} key={metric.label}>
              <Icon size={18} />
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </article>
          );
        })}
      </div>

      <section className="panel eval-report-panel" aria-labelledby="eval-report-title">
        <div className="panel-heading">
          <div>
            <h2 id="eval-report-title">Evals dos agentes</h2>
            <p>Baseline executavel de intake, RAG, decisao e trajetoria.</p>
          </div>
          <Badge tone={evalReportTone(evalReport)}>{evalReport ? `${evalReport.passRate}% pass rate` : "Indisponivel"}</Badge>
        </div>

        {evalReport ? (
          <>
            <div className="eval-summary-grid">
              <div>
                <span>Casos aprovados</span>
                <strong>{evalReport.passedCases}/{evalReport.totalCases}</strong>
                <small>{evalReport.failedCases ? `${evalReport.failedCases} falha(s)` : "Baseline sem falhas"}</small>
              </div>
              <div>
                <span>Score agregado</span>
                <strong>{evalReport.score}%</strong>
                <small>{evalReport.modelRoute}</small>
              </div>
              <div>
                <span>Gerado em</span>
                <strong>{formatDateTime(evalReport.generatedAt)}</strong>
                <small>{evalReport.executionMode === "deterministic-fallback" ? "Fallback deterministico" : "Cascata de modelo"}</small>
              </div>
            </div>

            <div className="eval-case-list">
              {[...evalReport.cases].sort((left, right) => Number(left.passed) - Number(right.passed)).map((item) => (
                <article className={`eval-case-row ${item.passed ? "passed" : "failed"}`} key={item.id}>
                  <div>
                    <strong>{evalCaseTitle(item)}</strong>
                    <span>{evalCaseDetail(item)}</span>
                  </div>
                  <Badge tone={item.passed ? "success" : "danger"}>{item.passed ? "Aprovado" : "Falhou"}</Badge>
                  <small>{item.score}% - {item.durationMs} ms</small>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="empty-inline">Relatorio de eval indisponivel neste carregamento.</p>
        )}
      </section>

      <section className="panel feedback-health-panel" aria-labelledby="feedback-health-title">
        <div className="panel-heading">
          <div>
            <h2 id="feedback-health-title">Feedback humano</h2>
            <p>Qualidade percebida pelos analistas no escopo atual.</p>
          </div>
          <Badge tone={model.feedbackHealth.tone}>
            {model.feedbackHealth.total ? `${model.feedbackHealth.negative} revisar` : "Sem feedback"}
          </Badge>
        </div>

        <div className="feedback-summary-grid">
          {model.feedbackHealth.metrics.map((metric) => (
            <article className={`feedback-summary-card ${metric.tone}`} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </article>
          ))}
        </div>

        <div className="feedback-split">
          <div>
            <h3>Por decisao</h3>
            <div className="feedback-decision-grid">
              <div>
                <span>Triagem</span>
                <strong>{model.feedbackHealth.triage}</strong>
              </div>
              <div>
                <span>Rascunho</span>
                <strong>{model.feedbackHealth.resolutionDraft}</strong>
              </div>
            </div>
            <p className="feedback-recommendation">{model.feedbackHealth.recommendation}</p>
          </div>

          <div>
            <h3>Feedback recente</h3>
            <div className="feedback-list">
              {model.feedbackHealth.recent.length ? (
                model.feedbackHealth.recent.map((item) => (
                  <article className={`feedback-row ${item.rating}`} key={item.id}>
                    <div>
                      <strong>{item.ticketNumber} - {feedbackDecisionLabel(item.decision)}</strong>
                      <span>{item.note || item.ticketTitle}</span>
                      <small>{item.actorName} - {formatDateTime(item.createdAt)}</small>
                    </div>
                    <Badge tone={feedbackRatingTone(item.rating)}>{feedbackRatingLabel(item.rating)}</Badge>
                  </article>
                ))
              ) : (
                <p className="empty-inline">Nenhum feedback registrado ainda.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="panel knowledge-health-panel" aria-labelledby="knowledge-health-title">
        <div className="panel-heading">
          <div>
            <h2 id="knowledge-health-title">Saude da base RAG</h2>
            <p>Cobertura, catalogo e revisao das fontes usadas pelos agentes.</p>
          </div>
          <Badge tone={model.knowledgeHealth.tone}>{model.knowledgeHealth.coveragePct}% cobertura</Badge>
        </div>

        <div className="knowledge-summary-grid">
          {model.knowledgeHealth.metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article className={`knowledge-summary-card ${metric.tone}`} key={metric.label}>
                <Icon size={17} />
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.detail}</small>
              </article>
            );
          })}
        </div>

        <div className="knowledge-split">
          <div>
            <h3>Fontes mais usadas</h3>
            <div className="knowledge-list">
              {model.knowledgeHealth.topSources.length ? (
                model.knowledgeHealth.topSources.map((source) => (
                  <article className="knowledge-row" key={source.id}>
                    <div>
                      <strong>{source.title}</strong>
                      <span>{source.id} - {source.count} uso(s)</span>
                    </div>
                    <Badge tone={source.cataloged ? "success" : "warning"}>{source.cataloged ? "Catalogada" : "Sem catalogo"}</Badge>
                  </article>
                ))
              ) : (
                <p className="empty-inline">Nenhuma fonte RAG usada ainda.</p>
              )}
            </div>
          </div>

          <div>
            <h3>Lacunas por servico</h3>
            <div className="knowledge-list">
              {model.knowledgeHealth.serviceGaps.length ? (
                model.knowledgeHealth.serviceGaps.map((gap) => (
                  <article className="knowledge-row" key={gap.service}>
                    <div>
                      <strong>{gap.service}</strong>
                      <span>{gap.count} chamado(s) ativo(s) sem fonte RAG</span>
                    </div>
                    <Badge tone="warning">Revisar</Badge>
                  </article>
                ))
              ) : (
                <p className="empty-inline">Todos os chamados ativos tem fonte RAG vinculada.</p>
              )}
            </div>
          </div>

          <div>
            <h3>Artigos para revisao</h3>
            <div className="knowledge-list">
              {model.knowledgeHealth.reviewArticles.length ? (
                model.knowledgeHealth.reviewArticles.map((article) => (
                  <article className="knowledge-row" key={article.id}>
                    <div>
                      <strong>{article.title}</strong>
                      <span>{article.category} - atualizado em {formatDate(article.updatedAt)}</span>
                    </div>
                    <Badge tone="warning">{article.status === "needs_review" ? "Revisao" : "Vencido"}</Badge>
                  </article>
                ))
              ) : (
                <p className="empty-inline">Nenhum artigo venceu a cadencia de revisao.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="governance-grid">
        <section className="panel improvement-panel" aria-labelledby="improvement-title">
          <div className="panel-heading">
            <div>
              <h2 id="improvement-title">Melhorias recomendadas</h2>
              <p>Priorizacao operacional para o proximo ciclo.</p>
            </div>
            <Badge tone="info">{model.recommendations.length} acoes</Badge>
          </div>
          <div className="improvement-list">
            {model.recommendations.map((item) => (
              <article className={`improvement-card ${item.priority}`} key={item.id}>
                <div>
                  <Badge tone={recommendationTone(item.priority)}>{recommendationLabel(item.priority)}</Badge>
                  <h3>{item.title}</h3>
                  <p>{item.evidence}</p>
                </div>
                <strong>{item.action}</strong>
              </article>
            ))}
          </div>
        </section>

        <aside className="panel governance-health-panel" aria-labelledby="health-title">
          <div className="panel-heading">
            <div>
              <h2 id="health-title">Saude dos agentes</h2>
              <p>Execucao recente, erros e latencia.</p>
            </div>
          </div>
          <div className="agent-health-grid">
            <div>
              <span>Spans</span>
              <strong>{traces.length}</strong>
            </div>
            <div>
              <span>Erros</span>
              <strong>{model.traceErrors.length}</strong>
            </div>
            <div>
              <span>Media</span>
              <strong>{model.averageTraceMs} ms</strong>
            </div>
          </div>
          <div className="trace-list compact">
            {model.recentSpans.length ? (
              model.recentSpans.map((span) => (
                <div className={`trace-row ${span.status}`} key={span.id}>
                  <span>{span.kind}</span>
                  <strong>{span.name}</strong>
                  <small>{span.durationMs} ms</small>
                </div>
              ))
            ) : (
              <small>Nenhum span registrado ainda.</small>
            )}
          </div>
        </aside>
      </div>

      <div className="governance-grid secondary">
        <section className="panel risk-ticket-panel" aria-labelledby="risk-ticket-title">
          <div className="panel-heading">
            <div>
              <h2 id="risk-ticket-title">Chamados com acao recomendada</h2>
              <p>Itens que explicam as recomendacoes acima.</p>
            </div>
            <Badge tone={model.riskTickets.length ? "warning" : "success"}>{model.riskTickets.length} chamados</Badge>
          </div>
          {model.riskTickets.length ? (
            <div className="risk-ticket-list">
              {model.riskTickets.map((ticket) => (
                <button type="button" className="risk-ticket-row" key={ticket.id} onClick={() => onOpenTicket(ticket)}>
                  <div>
                    <span className="row-link">{ticket.number}</span>
                    <strong>{ticket.title}</strong>
                    <small>{ticket.assignedGroupName ?? "Sem grupo"} - {ticket.requesterEmail}</small>
                  </div>
                  <Badge tone={statusTone(ticket.status)}>{statusLabel(ticket.status)}</Badge>
                  <Badge tone={priorityTone(ticket.priority)}>{priorityLabel(ticket.priority)}</Badge>
                  <SlaBadge ticket={ticket} />
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <CheckCircle2 size={28} />
              <h3>Sem chamado critico para governanca</h3>
              <p>A fila autorizada nao tem pendencia de aprovacao, SLA ou baixa confianca.</p>
            </div>
          )}
        </section>

        <aside className="panel audit-feed-panel" aria-labelledby="audit-feed-title">
          <div className="panel-heading">
            <div>
              <h2 id="audit-feed-title">Auditoria recente</h2>
              <p>Eventos de dominio e agentes.</p>
            </div>
          </div>
          <div className="audit-feed-list">
            {model.recentAudit.length ? (
              model.recentAudit.map((entry) => (
                <article key={entry.id}>
                  <span>{entry.eventType}</span>
                  <strong>{entry.message}</strong>
                  <small>{formatDateTime(entry.occurredAt)}</small>
                </article>
              ))
            ) : (
              <small>Nenhum evento de auditoria registrado ainda.</small>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

