import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileSearch,
  Gauge,
  ImagePlus,
  KeyRound,
  LifeBuoy,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  X
} from "lucide-react";
import {
  createTicket,
  listAgentTraces,
  listTickets,
  type CreateTicketPayload,
  type Ticket,
  type TicketPriority,
  type TraceSpan
} from "./lib/api";

type View = "queue" | "new" | "detail";

const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

const initialForm: CreateTicketPayload = {
  requesterEmail: "ana.silva@acme.local",
  department: "Financeiro",
  title: "Faturamento bloqueado no ERP",
  description:
    "O lote de faturamento do ERP falhou desde 09:00 e a filial SP nao consegue fechar as notas do mes. O erro aparece ao confirmar o lote fiscal.",
  affectedService: "ERP Central",
  urgency: "critical",
  businessImpact: "Fechamento mensal bloqueado para uma unidade de receita.",
  attachments: []
};

export default function App() {
  const [view, setView] = useState<View>("queue");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateTicketPayload>(initialForm);
  const [traces, setTraces] = useState<TraceSpan[]>([]);

  useEffect(() => {
    void refreshWorkspace();
  }, []);

  const selectedTicket = useMemo(() => tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0], [selectedId, tickets]);

  async function refreshWorkspace() {
    await Promise.all([refreshTickets(), refreshTraces()]);
  }

  async function refreshTickets() {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await listTickets();
      setTickets(loaded);
      setSelectedId((current) => current ?? loaded[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load tickets.");
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshTraces() {
    try {
      const loaded = await listAgentTraces();
      setTraces(loaded);
    } catch {
      setTraces([]);
    }
  }

  async function handleCreateTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const ticket = await createTicket(form);
      setTickets((current) => [ticket, ...current]);
      setSelectedId(ticket.id);
      setView("detail");
      void refreshTraces();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create ticket.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar active={view} onNavigate={setView} />
      <main className="workspace">
        <Topbar view={view} onCreate={() => setView("new")} onRefresh={() => void refreshWorkspace()} />
        {error ? (
          <div className="inline-alert" role="alert">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        {view === "queue" ? (
          <QueueView
            tickets={tickets}
            traces={traces}
            isLoading={isLoading}
            selectedId={selectedTicket?.id}
            onSelect={(ticket) => {
              setSelectedId(ticket.id);
              setView("detail");
            }}
          />
        ) : null}

        {view === "new" ? (
          <IntakeView
            form={form}
            setForm={setForm}
            isSubmitting={isSubmitting}
            onSubmit={handleCreateTicket}
          />
        ) : null}

        {view === "detail" && selectedTicket ? <DetailView ticket={selectedTicket} traces={traces} /> : null}
      </main>
    </div>
  );
}

function Sidebar({ active, onNavigate }: { active: View; onNavigate: (view: View) => void }) {
  const items = [
    { id: "queue" as const, label: "Fila", icon: ClipboardList },
    { id: "new" as const, label: "Novo chamado", icon: Plus },
    { id: "detail" as const, label: "Detalhe", icon: TicketCheck }
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Bot size={20} />
        </div>
        <div>
          <strong>AI Service Desk</strong>
          <span>Operacoes de suporte</span>
        </div>
      </div>
      <nav aria-label="Principal">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={active === item.id ? "nav-item active" : "nav-item"}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <ShieldCheck size={18} />
        <span>API guard ativo</span>
      </div>
    </aside>
  );
}

function Topbar({ view, onCreate, onRefresh }: { view: View; onCreate: () => void; onRefresh: () => void }) {
  const title = view === "new" ? "Abrir chamado" : view === "detail" ? "Workspace do chamado" : "Fila de chamados";

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Service desk com IA</p>
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        <label className="search-box">
          <Search size={17} />
          <span className="sr-only">Buscar chamados</span>
          <input aria-label="Buscar chamados" placeholder="Buscar por numero, servico ou solicitante" />
        </label>
        <button type="button" className="icon-button" onClick={onRefresh} aria-label="Atualizar fila">
          <RefreshCw size={18} />
        </button>
        <button type="button" className="primary-button" onClick={onCreate}>
          <Plus size={18} />
          <span>Abrir chamado</span>
        </button>
      </div>
    </header>
  );
}

function QueueView({
  tickets,
  traces,
  isLoading,
  selectedId,
  onSelect
}: {
  tickets: Ticket[];
  traces: TraceSpan[];
  isLoading: boolean;
  selectedId?: string;
  onSelect: (ticket: Ticket) => void;
}) {
  const metrics = useMemo(() => {
    const open = tickets.filter((ticket) => ticket.status !== "resolved").length;
    const critical = tickets.filter((ticket) => ticket.priority === "critical").length;
    const avgConfidence = tickets
      .map((ticket) => ticket.ai.triage?.confidence ?? 0)
      .filter(Boolean);
    const confidence = avgConfidence.length
      ? Math.round((avgConfidence.reduce((sum, value) => sum + value, 0) / avgConfidence.length) * 100)
      : 0;

    return [
      { label: "Abertos", value: open.toString(), icon: TicketCheck },
      { label: "Risco SLA", value: critical.toString(), icon: AlertTriangle },
      { label: "Confianca IA", value: `${confidence}%`, icon: Sparkles },
      { label: "Gateway", value: "AI SDK", icon: Activity }
    ];
  }, [tickets]);

  return (
    <section className="queue-layout" aria-label="Fila operacional">
      <MetricStrip metrics={metrics} />
      <div className="content-grid">
        <section className="panel queue-panel" aria-labelledby="queue-title">
          <div className="panel-heading">
            <div>
              <h2 id="queue-title">Chamados recentes</h2>
              <p>Priorize por impacto, SLA e confianca da triagem.</p>
            </div>
            <button type="button" className="secondary-button">
              <Gauge size={17} />
              <span>Filtros</span>
            </button>
          </div>
          {isLoading ? <SkeletonRows /> : <TicketTable tickets={tickets} selectedId={selectedId} onSelect={onSelect} />}
        </section>
        <AgentRail ticket={tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0]} traces={traces} />
      </div>
    </section>
  );
}

function MetricStrip({ metrics }: { metrics: Array<{ label: string; value: string; icon: typeof Activity }> }) {
  return (
    <div className="metric-strip" aria-label="Metricas da fila">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div className="metric" key={metric.label}>
            <Icon size={18} />
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        );
      })}
    </div>
  );
}

function TicketTable({
  tickets,
  selectedId,
  onSelect
}: {
  tickets: Ticket[];
  selectedId?: string;
  onSelect: (ticket: Ticket) => void;
}) {
  if (tickets.length === 0) {
    return (
      <div className="empty-state">
        <FileSearch size={28} />
        <h3>Nenhum chamado aberto</h3>
        <p>Chamados criados pelo fluxo assistido aparecem aqui com triagem, fontes e auditoria.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Chamado</th>
            <th>Servico</th>
            <th>Solicitante</th>
            <th>Categoria</th>
            <th>Prioridade</th>
            <th>Status</th>
            <th>Confianca</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr
              key={ticket.id}
              className={ticket.id === selectedId ? "selected-row" : undefined}
              onClick={() => onSelect(ticket)}
            >
              <td>
                <button type="button" className="row-link" onClick={() => onSelect(ticket)}>
                  <span>{ticket.number}</span>
                  <ChevronRight size={15} />
                </button>
                <small>{ticket.title}</small>
              </td>
              <td>{ticket.affectedService}</td>
              <td>{ticket.requesterEmail}</td>
              <td>{ticket.category}</td>
              <td>
                <Badge tone={priorityTone(ticket.priority)}>{ticket.priority}</Badge>
              </td>
              <td>
                <Badge tone={statusTone(ticket.status)}>{ticket.status}</Badge>
              </td>
              <td>{Math.round((ticket.ai.triage?.confidence ?? 0) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IntakeView({
  form,
  setForm,
  isSubmitting,
  onSubmit
}: {
  form: CreateTicketPayload;
  setForm: (form: CreateTicketPayload) => void;
  isSubmitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const analysis = useMemo(() => analyzeDraft(form), [form]);
  const remainingAttachments = MAX_ATTACHMENTS - form.attachments.length;

  async function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const imageFiles = files
      .filter((file) => file.type.startsWith("image/") && file.size <= MAX_ATTACHMENT_BYTES)
      .slice(0, Math.max(remainingAttachments, 0));

    if (imageFiles.length > 0) {
      const encoded = await Promise.all(imageFiles.map(readFileAsDataUrl));
      setForm({ ...form, attachments: [...form.attachments, ...encoded] });
    }

    event.target.value = "";
  }

  function removeAttachment(index: number) {
    setForm({ ...form, attachments: form.attachments.filter((_, currentIndex) => currentIndex !== index) });
  }

  return (
    <form className="intake-layout" onSubmit={onSubmit}>
      <section className="panel intake-form" aria-labelledby="intake-title">
        <div className="panel-heading">
          <div>
            <h2 id="intake-title">Dados do chamado</h2>
            <p>Texto livre alimenta triagem, busca vetorial e rascunho inicial.</p>
          </div>
        </div>
        <div className="form-grid">
          <Field label="Solicitante">
            <input
              required
              type="email"
              value={form.requesterEmail}
              onChange={(event) => setForm({ ...form, requesterEmail: event.target.value })}
            />
          </Field>
          <Field label="Departamento">
            <input
              required
              value={form.department}
              onChange={(event) => setForm({ ...form, department: event.target.value })}
            />
          </Field>
          <Field label="Titulo">
            <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </Field>
          <Field label="Servico afetado">
            <select value={form.affectedService} onChange={(event) => setForm({ ...form, affectedService: event.target.value })}>
              <option>ERP Central</option>
              <option>Rede Corporativa</option>
              <option>Identity Access</option>
              <option>Portal Cliente</option>
            </select>
          </Field>
          <Field label="Descricao" wide>
            <textarea
              required
              minLength={20}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
          <Field label="Urgencia">
            <select value={form.urgency} onChange={(event) => setForm({ ...form, urgency: event.target.value as TicketPriority })}>
              <option value="low">Baixa</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Critica</option>
            </select>
          </Field>
          <Field label="Impacto">
            <input
              required
              value={form.businessImpact}
              onChange={(event) => setForm({ ...form, businessImpact: event.target.value })}
            />
          </Field>
          <div className="field wide">
            <span>Imagens</span>
            <label className="attachment-drop">
              <ImagePlus size={22} />
              <strong>Anexar evidencia visual</strong>
              <small>PNG, JPG, WebP ou GIF ate 2 MB. Limite de {MAX_ATTACHMENTS} imagens.</small>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                disabled={remainingAttachments <= 0}
                onChange={handleAttachmentChange}
              />
            </label>
            {form.attachments.length ? (
              <div className="attachment-grid" aria-label="Imagens anexadas">
                {form.attachments.map((attachment, index) => (
                  <div className="attachment-thumb" key={`${attachment.slice(0, 40)}-${index}`}>
                    <img src={attachment} alt={`Anexo ${index + 1}`} />
                    <button
                      type="button"
                      className="remove-attachment"
                      onClick={() => removeAttachment(index)}
                      aria-label={`Remover anexo ${index + 1}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="sticky-actions">
          <button type="button" className="secondary-button" disabled={isSubmitting}>
            <RefreshCw size={17} />
            <span>Reprocessar analise</span>
          </button>
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
            <span>Criar chamado</span>
          </button>
        </div>
      </section>
      <section className="panel ai-panel" aria-labelledby="analysis-title">
        <div className="panel-heading">
          <div>
            <h2 id="analysis-title">Analise da IA</h2>
            <p>Decisoes ficam auditaveis antes da criacao.</p>
          </div>
          <Badge tone={analysis.confidence < 70 ? "warning" : "success"}>{analysis.confidence}%</Badge>
        </div>
        <div className="analysis-list">
          <AnalysisItem label="Intento" value={analysis.intent} />
          <AnalysisItem label="Categoria" value={analysis.category} />
          <AnalysisItem label="Prioridade" value={analysis.priority} />
          <AnalysisItem label="SLA" value={analysis.sla} />
        </div>
        <div className="source-list">
          <h3>Fontes provaveis</h3>
          {analysis.sources.map((source) => (
            <article key={source} className="source-row">
              <FileSearch size={16} />
              <span>{source}</span>
            </article>
          ))}
        </div>
        {analysis.confidence < 70 ? (
          <label className="review-check">
            <input type="checkbox" required />
            <span>Revisao humana obrigatoria para baixa confianca</span>
          </label>
        ) : null}
      </section>
    </form>
  );
}

function DetailView({ ticket, traces }: { ticket: Ticket; traces: TraceSpan[] }) {
  const triage = ticket.ai.triage;
  const draft = ticket.ai.resolutionDraft;

  return (
    <section className="detail-layout" aria-label="Detalhe do chamado">
      <div className="detail-header panel">
        <div>
          <p className="eyebrow">{ticket.number}</p>
          <h2>{ticket.title}</h2>
          <p>{ticket.requesterEmail} - {ticket.affectedService}</p>
        </div>
        <div className="header-badges">
          <Badge tone={priorityTone(ticket.priority)}>{ticket.priority}</Badge>
          <Badge tone={statusTone(ticket.status)}>{ticket.status}</Badge>
        </div>
      </div>
      <div className="detail-grid">
        <section className="panel timeline-panel" aria-labelledby="timeline-title">
          <div className="panel-heading">
            <div>
              <h2 id="timeline-title">Linha do tempo</h2>
              <p>Mensagens e rascunhos aprovaveis.</p>
            </div>
          </div>
          <div className="timeline">
            {ticket.timeline.map((event) => (
              <article key={event.id} className={`timeline-item ${event.actor}`}>
                <span>{event.actor}</span>
                <p>{event.message}</p>
              </article>
            ))}
            {draft ? (
              <article className="timeline-item agent draft">
                <span>AI draft</span>
                <p>{draft.summary}</p>
                <div className="inline-actions">
                  <button type="button" className="primary-button small">
                    <CheckCircle2 size={16} />
                    <span>Aprovar resposta</span>
                  </button>
                  <button type="button" className="secondary-button small">
                    <RefreshCw size={16} />
                    <span>Gerar novamente</span>
                  </button>
                </div>
              </article>
            ) : null}
          </div>
        </section>
        <section className="panel context-panel" aria-labelledby="context-title">
          <div className="panel-heading">
            <div>
              <h2 id="context-title">Contexto</h2>
              <p>Campos normalizados pelo agente.</p>
            </div>
          </div>
          <AnalysisItem label="Categoria" value={ticket.category} />
          <AnalysisItem label="Impacto" value={ticket.businessImpact} />
          <AnalysisItem label="Tags" value={ticket.tags.join(", ") || "Sem tags"} />
          <div className="ticket-attachments">
            <h3>Imagens anexadas</h3>
            {ticket.attachments.length ? (
              <div className="attachment-grid readonly" aria-label="Imagens do chamado">
                {ticket.attachments.map((attachment, index) => (
                  <a
                    className="attachment-thumb"
                    href={attachment}
                    target="_blank"
                    rel="noreferrer"
                    key={`${ticket.id}-attachment-${index}`}
                  >
                    <img src={attachment} alt={`Imagem anexada ${index + 1}`} />
                  </a>
                ))}
              </div>
            ) : (
              <p>Sem imagens anexadas.</p>
            )}
          </div>
          <div className="checklist">
            <h3>Runbook</h3>
            {["Validar servico", "Confirmar usuarios afetados", "Executar passo seguro", "Registrar evidencia"].map((item, index) => (
              <label key={item}>
                <input type="checkbox" defaultChecked={index < 2} />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </section>
        <AgentRail ticket={ticket} traces={traces} />
      </div>
      {triage ? (
        <section className="panel evidence-panel" aria-labelledby="evidence-title">
          <div className="panel-heading">
            <div>
              <h2 id="evidence-title">Evidencias RAG</h2>
              <p>Fontes usadas para classificar e redigir a resposta.</p>
            </div>
            <Badge tone="info">Google via AI SDK</Badge>
          </div>
          <div className="evidence-grid">
            {ticket.ai.retrievedSources.map((source) => (
              <article key={source.id} className="evidence-row">
                <div>
                  <strong>{source.title}</strong>
                  <span>{source.source}</span>
                </div>
                <p>{source.excerpt}</p>
                <Badge tone="neutral">{Math.round(source.relevance * 100)}%</Badge>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function AgentRail({ ticket, traces }: { ticket?: Ticket; traces: TraceSpan[] }) {
  const triage = ticket?.ai.triage;
  const draft = ticket?.ai.resolutionDraft;
  const traceId = typeof triage?.metadata?.traceId === "string" ? triage.metadata.traceId : undefined;
  const visibleSpans = traceId ? traces.filter((span) => span.traceId === traceId).slice(0, 5) : traces.slice(0, 5);
  const steps = [
    { label: "Intake parser", state: "done", icon: ClipboardList, meta: "120 ms" },
    { label: "Knowledge retrieval", state: ticket?.ai.retrievedSources.length ? "done" : "waiting", icon: FileSearch, meta: `${ticket?.ai.retrievedSources.length ?? 0} fontes` },
    { label: "Triage classifier", state: triage ? "done" : "waiting", icon: Sparkles, meta: triage ? `${Math.round(triage.confidence * 100)}%` : "pendente" },
    { label: "Resolution drafter", state: draft ? "done" : "waiting", icon: Bot, meta: draft ? `${Math.round(draft.confidence * 100)}%` : "pendente" },
    { label: "Policy guardrail", state: "done", icon: ShieldCheck, meta: "pass" }
  ];

  return (
    <aside className="panel agent-rail" aria-labelledby="agent-title">
      <div className="panel-heading">
        <div>
          <h2 id="agent-title">Atividade dos agentes</h2>
          <p>Execucao rastreavel por etapa.</p>
        </div>
      </div>
      <div className="agent-steps">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div className={`agent-step ${step.state}`} key={step.label}>
              <Icon size={17} />
              <div>
                <strong>{step.label}</strong>
                <span>{step.meta}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="governance">
        <h3>Governanca</h3>
        <p><KeyRound size={15} /> Escopo: service-desk.write</p>
        <p><ShieldCheck size={15} /> Policy: aprovado</p>
        <p><LifeBuoy size={15} /> Human override: disponivel</p>
      </div>
      <div className="trace-card">
        <h3>Rastreio</h3>
        <p className="trace-id">{traceId ?? "Sem trace vinculado"}</p>
        <div className="trace-list">
          {visibleSpans.length ? (
            visibleSpans.map((span) => (
              <div className={`trace-row ${span.status}`} key={span.id}>
                <span>{span.kind}</span>
                <strong>{span.name}</strong>
                <small>{span.durationMs} ms</small>
              </div>
            ))
          ) : (
            <small>Nenhum span registrado.</small>
          )}
        </div>
      </div>
    </aside>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={wide ? "field wide" : "field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function AnalysisItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="analysis-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function SkeletonRows() {
  return (
    <div className="skeleton-rows" aria-label="Carregando chamados">
      {Array.from({ length: 6 }).map((_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image attachment."));
    reader.readAsDataURL(file);
  });
}

function analyzeDraft(form: CreateTicketPayload) {
  const text = `${form.title} ${form.description} ${form.businessImpact}`.toLowerCase();
  const critical = /(faturamento|bloqueado|parado|critico|security|seguranca)/.test(text);
  const access = /(senha|mfa|login|acesso)/.test(text);
  const network = /(vpn|rede|latencia|conexao)/.test(text);

  return {
    intent: critical ? "Incidente com impacto operacional" : "Solicitacao de suporte",
    category: access ? "Identity Access" : network ? "Network" : critical ? "ERP" : form.affectedService,
    priority: critical ? "critical" : form.urgency,
    sla: critical ? "P1 - 15 min" : form.urgency === "high" ? "P2 - 1 hora" : "P3 - dia util",
    confidence: form.description.length > 80 ? 86 : 58,
    sources: critical
      ? ["ERP billing batch failure runbook", "Priority and SLA classification"]
      : ["Identity access reset policy", "Priority and SLA classification"]
  };
}

function priorityTone(priority: string) {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warning";
  if (priority === "medium") return "info";
  return "neutral";
}

function statusTone(status: string) {
  if (status === "resolved") return "success";
  if (status === "escalated") return "danger";
  if (status === "triaging") return "info";
  return "neutral";
}
