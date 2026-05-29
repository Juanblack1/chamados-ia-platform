import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Bot,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileSearch,
  ImagePlus,
  KeyRound,
  LifeBuoy,
  ListFilter,
  Loader2,
  LockKeyhole,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  TicketCheck,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import {
  addFollowup,
  addTask,
  assignTicket,
  completeTask,
  createTicket,
  getCatalog,
  getSession,
  listAgentTraces,
  listTickets,
  login,
  logout,
  resolveTicket,
  updateTicketStatus,
  type AppUser,
  type CreateTicketPayload,
  type ServiceDeskCatalog,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
  type TraceSpan
} from "./lib/api";

type View = "queue" | "new" | "detail" | "admin";

const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

const initialForm: CreateTicketPayload = {
  type: "incident",
  requesterEmail: "",
  department: "Operacoes",
  title: "",
  description: "",
  affectedService: "ERP Central",
  urgency: "medium",
  impact: "medium",
  businessImpact: "",
  attachments: []
};

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [view, setView] = useState<View>("queue");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [traces, setTraces] = useState<TraceSpan[]>([]);
  const [catalog, setCatalog] = useState<ServiceDeskCatalog | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [form, setForm] = useState<CreateTicketPayload>(initialForm);

  useEffect(() => {
    void boot();
  }, []);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0],
    [selectedId, tickets]
  );

  const visibleTickets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
      const matchesTerm =
        !term ||
        [ticket.number, ticket.title, ticket.requesterEmail, ticket.affectedService, ticket.assignedGroupName, ticket.assigneeName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      return matchesStatus && matchesTerm;
    });
  }, [search, statusFilter, tickets]);

  async function boot() {
    setIsBooting(true);
    try {
      const session = await getSession();
      setUser(session.user);
      setForm({ ...initialForm, requesterEmail: session.user.email });
      await refreshWorkspace();
    } catch {
      setUser(null);
    } finally {
      setIsBooting(false);
    }
  }

  async function refreshWorkspace() {
    setIsLoading(true);
    setError(null);
    try {
      const [loadedTickets, loadedTraces, loadedCatalog] = await Promise.all([
        listTickets(),
        listAgentTraces(),
        getCatalog()
      ]);
      setTickets(loadedTickets);
      setTraces(loadedTraces);
      setCatalog(loadedCatalog);
      setSelectedId((current) => current ?? loadedTickets[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel carregar o workspace.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogin(email: string, password: string) {
    setError(null);
    const session = await login(email, password);
    setUser(session.user);
    setForm({ ...initialForm, requesterEmail: session.user.email });
    await refreshWorkspace();
  }

  async function handleLogout() {
    await logout();
    setUser(null);
    setTickets([]);
    setSelectedId(null);
    setView("queue");
  }

  async function handleCreateTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = user.role === "requester" ? { ...form, requesterEmail: user.email } : form;
      const ticket = await createTicket(payload);
      setTickets((current) => [ticket, ...current]);
      setSelectedId(ticket.id);
      setView("detail");
      setForm({ ...initialForm, requesterEmail: user.email });
      void refreshWorkspace();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel criar o chamado.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function mutateTicket(action: () => Promise<Ticket>) {
    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await action();
      setTickets((current) => current.map((ticket) => (ticket.id === updated.id ? updated : ticket)));
      setSelectedId(updated.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel concluir a acao.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isBooting) return <BootScreen />;

  if (!user) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        error={error}
        setError={setError}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar user={user} active={view} onNavigate={setView} onLogout={() => void handleLogout()} />
      <main className="workspace">
        <Topbar
          view={view}
          user={user}
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onCreate={() => setView("new")}
          onRefresh={() => void refreshWorkspace()}
          isLoading={isLoading}
        />
        {error ? (
          <div className="inline-alert" role="alert">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        {view === "queue" ? (
          <QueueView
            tickets={visibleTickets}
            allTickets={tickets}
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
            user={user}
            form={form.requesterEmail ? form : { ...form, requesterEmail: user.email }}
            setForm={setForm}
            isSubmitting={isSubmitting}
            onSubmit={handleCreateTicket}
          />
        ) : null}

        {view === "detail" && selectedTicket ? (
          <DetailView
            user={user}
            ticket={selectedTicket}
            traces={traces}
            isSubmitting={isSubmitting}
            onAssign={() => mutateTicket(() => assignTicket(selectedTicket.id))}
            onStatus={(status) => mutateTicket(() => updateTicketStatus(selectedTicket.id, status))}
            onFollowup={(message, visibility) => mutateTicket(() => addFollowup(selectedTicket.id, message, visibility))}
            onTask={(title, description) => mutateTicket(() => addTask(selectedTicket.id, title, description))}
            onCompleteTask={(taskId) => mutateTicket(() => completeTask(selectedTicket.id, taskId))}
            onResolve={(message) => mutateTicket(() => resolveTicket(selectedTicket.id, message))}
          />
        ) : null}

        {view === "admin" ? <AdminView user={user} catalog={catalog} /> : null}
      </main>
    </div>
  );
}

function BootScreen() {
  return (
    <div className="boot-screen">
      <Loader2 className="spin" size={24} />
      <span>Carregando sessao</span>
    </div>
  );
}

function LoginScreen({
  onLogin,
  error,
  setError
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  error: string | null;
  setError: (message: string | null) => void;
}) {
  const [email, setEmail] = useState("admin@empresa.local");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await onLogin(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel entrar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand-mark large">
          <LifeBuoy size={24} />
        </div>
        <div>
          <p className="eyebrow">Acesso corporativo</p>
          <h1>Service Desk IA</h1>
          <p>Entre para operar chamados, SLAs, agentes e auditoria.</p>
        </div>
        {error ? (
          <div className="inline-alert compact" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        ) : null}
        <Field label="E-mail corporativo">
          <input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Senha">
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <button type="submit" className="primary-button wide" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="spin" size={18} /> : <LockKeyhole size={18} />}
          <span>Entrar</span>
        </button>
        <p className="security-note">
          <KeyRound size={15} /> Sessao HttpOnly com controle por perfil.
        </p>
      </form>
    </main>
  );
}

function Sidebar({
  user,
  active,
  onNavigate,
  onLogout
}: {
  user: AppUser;
  active: View;
  onNavigate: (view: View) => void;
  onLogout: () => void;
}) {
  const requester = user.role === "requester";
  const items = [
    { id: "queue" as const, label: requester ? "Meus chamados" : "Minha fila", icon: ClipboardList },
    { id: "new" as const, label: "Abrir chamado", icon: Plus },
    ...(requester ? [] : [{ id: "detail" as const, label: "Workspace", icon: TicketCheck }]),
    ...(user.role === "admin" ? [{ id: "admin" as const, label: "Administracao", icon: Settings }] : [])
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Bot size={20} />
        </div>
        <div>
          <strong>Service Desk IA</strong>
          <span>{user.entityName}</span>
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
        <div className="user-block">
          <UserRound size={18} />
          <div>
            <strong>{user.name}</strong>
            <span>{roleLabel(user.role)}</span>
          </div>
        </div>
        <button type="button" className="nav-item logout" onClick={onLogout}>
          <LogOut size={18} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}

function Topbar({
  view,
  user,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  onCreate,
  onRefresh,
  isLoading
}: {
  view: View;
  user: AppUser;
  search: string;
  setSearch: (value: string) => void;
  statusFilter: TicketStatus | "all";
  setStatusFilter: (value: TicketStatus | "all") => void;
  onCreate: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}) {
  const title = view === "new" ? "Abrir chamado" : view === "detail" ? "Workspace do chamado" : view === "admin" ? "Administracao" : user.role === "requester" ? "Meus chamados" : "Minha fila";

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{roleLabel(user.role)} · {user.entityName}</p>
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        {view === "queue" ? (
          <>
            <label className="search-box">
              <Search size={17} />
              <span className="sr-only">Buscar chamados</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar numero, servico ou solicitante" />
            </label>
            <label className="select-filter">
              <ListFilter size={16} />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TicketStatus | "all")}>
                <option value="all">Todos os status</option>
                <option value="open">Aberto</option>
                <option value="in_progress">Em atendimento</option>
                <option value="waiting_customer">Aguardando solicitante</option>
                <option value="escalated">Escalado</option>
                <option value="resolved">Resolvido</option>
              </select>
            </label>
          </>
        ) : null}
        <button type="button" className="icon-button" onClick={onRefresh} aria-label="Atualizar dados">
          {isLoading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
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
  allTickets,
  traces,
  isLoading,
  selectedId,
  onSelect
}: {
  tickets: Ticket[];
  allTickets: Ticket[];
  traces: TraceSpan[];
  isLoading: boolean;
  selectedId?: string;
  onSelect: (ticket: Ticket) => void;
}) {
  const metrics = useMemo(() => {
    const active = allTickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length;
    const breached = allTickets.filter((ticket) => slaRisk(ticket) === "breached").length;
    const critical = allTickets.filter((ticket) => ticket.priority === "critical").length;
    const confidenceItems = allTickets.map((ticket) => ticket.ai.triage?.confidence ?? 0).filter(Boolean);
    const confidence = confidenceItems.length
      ? Math.round((confidenceItems.reduce((sum, value) => sum + value, 0) / confidenceItems.length) * 100)
      : 0;

    return [
      { label: "Ativos", value: active.toString(), icon: TicketCheck },
      { label: "SLA vencido", value: breached.toString(), icon: Clock3 },
      { label: "Criticos", value: critical.toString(), icon: AlertTriangle },
      { label: "Confianca IA", value: `${confidence}%`, icon: Bot }
    ];
  }, [allTickets]);

  return (
    <section className="queue-layout" aria-label="Fila operacional">
      <MetricStrip metrics={metrics} />
      <div className="content-grid">
        <section className="panel queue-panel" aria-labelledby="queue-title">
          <div className="panel-heading">
            <div>
              <h2 id="queue-title">Chamados</h2>
              <p>Fila com SLA, atribuição, prioridade e proveniencia da IA.</p>
            </div>
            <Badge tone="neutral">{tickets.length} registros</Badge>
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

function TicketTable({ tickets, selectedId, onSelect }: { tickets: Ticket[]; selectedId?: string; onSelect: (ticket: Ticket) => void }) {
  if (tickets.length === 0) {
    return (
      <div className="empty-state">
        <FileSearch size={28} />
        <h3>Nenhum chamado encontrado</h3>
        <p>A fila mostra chamados permitidos pelo seu perfil. Ajuste os filtros ou abra o primeiro chamado.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Chamado</th>
            <th>Tipo</th>
            <th>Prioridade</th>
            <th>Status</th>
            <th>SLA</th>
            <th>Grupo</th>
            <th>Tecnico</th>
            <th>Solicitante</th>
            <th>Servico</th>
            <th>IA</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id} className={ticket.id === selectedId ? "selected-row" : undefined}>
              <td>
                <button type="button" className="row-link" onClick={() => onSelect(ticket)}>
                  {ticket.number}
                </button>
                <small>{ticket.title}</small>
              </td>
              <td>{typeLabel(ticket.type)}</td>
              <td><Badge tone={priorityTone(ticket.priority)}>{priorityLabel(ticket.priority)}</Badge></td>
              <td><Badge tone={statusTone(ticket.status)}>{statusLabel(ticket.status)}</Badge></td>
              <td><SlaBadge ticket={ticket} /></td>
              <td>{ticket.assignedGroupName ?? "Sem grupo"}</td>
              <td>{ticket.assigneeName ?? "Nao atribuido"}</td>
              <td>{ticket.requesterEmail}</td>
              <td>{ticket.affectedService}</td>
              <td>{Math.round((ticket.ai.triage?.confidence ?? 0) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IntakeView({
  user,
  form,
  setForm,
  isSubmitting,
  onSubmit
}: {
  user: AppUser;
  form: CreateTicketPayload;
  setForm: (form: CreateTicketPayload) => void;
  isSubmitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
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
            <p>A triagem calcula prioridade por urgencia e impacto e registra rastreio da IA.</p>
          </div>
        </div>
        <div className="form-grid">
          <Field label="Tipo">
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as "incident" | "request" })}>
              <option value="incident">Incidente</option>
              <option value="request">Solicitacao</option>
            </select>
          </Field>
          <Field label="Solicitante">
            <input
              required
              type="email"
              disabled={user.role === "requester"}
              value={user.role === "requester" ? user.email : form.requesterEmail}
              onChange={(event) => setForm({ ...form, requesterEmail: event.target.value })}
            />
          </Field>
          <Field label="Departamento">
            <input required value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} />
          </Field>
          <Field label="Servico afetado">
            <select value={form.affectedService} onChange={(event) => setForm({ ...form, affectedService: event.target.value })}>
              <option>ERP Central</option>
              <option>Rede Corporativa</option>
              <option>Identity Access</option>
              <option>Portal Cliente</option>
              <option>APIs Corporativas</option>
            </select>
          </Field>
          <Field label="Titulo" wide>
            <input required minLength={6} maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </Field>
          <Field label="Descricao" wide>
            <textarea required minLength={20} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
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
            <select value={form.impact} onChange={(event) => setForm({ ...form, impact: event.target.value as TicketPriority })}>
              <option value="low">Baixo</option>
              <option value="medium">Medio</option>
              <option value="high">Alto</option>
              <option value="critical">Critico</option>
            </select>
          </Field>
          <Field label="Impacto no negocio" wide>
            <input required value={form.businessImpact} onChange={(event) => setForm({ ...form, businessImpact: event.target.value })} />
          </Field>
          <div className="field wide">
            <span>Imagens</span>
            <label className="attachment-drop">
              <ImagePlus size={22} />
              <strong>Anexar evidencia visual</strong>
              <small>PNG, JPG, WebP ou GIF ate 2 MB. Limite de {MAX_ATTACHMENTS} imagens.</small>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple disabled={remainingAttachments <= 0} onChange={handleAttachmentChange} />
            </label>
            {form.attachments.length ? (
              <div className="attachment-grid" aria-label="Imagens anexadas">
                {form.attachments.map((attachment, index) => (
                  <div className="attachment-thumb" key={`${attachment.slice(0, 40)}-${index}`}>
                    <img src={attachment} alt={`Anexo ${index + 1}`} />
                    <button type="button" className="remove-attachment" onClick={() => removeAttachment(index)} aria-label={`Remover anexo ${index + 1}`}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="sticky-actions">
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
            <span>Criar chamado</span>
          </button>
        </div>
      </section>
      <section className="panel ai-panel" aria-labelledby="routing-title">
        <div className="panel-heading">
          <div>
            <h2 id="routing-title">Roteamento previsto</h2>
            <p>Previsao local antes da orquestracao final.</p>
          </div>
        </div>
        <div className="analysis-list">
          <AnalysisItem label="Prioridade" value={priorityLabel(estimatedPriority(form))} />
          <AnalysisItem label="SLA" value={estimatedPriority(form) === "critical" ? "P1 - resposta em 15 min" : estimatedPriority(form) === "high" ? "P2 - resposta em 1 h" : "P3/P4 - fila padrao"} />
          <AnalysisItem label="Grupo" value={estimatedGroup(form)} />
          <AnalysisItem label="Controle" value="Aprovacao humana para resposta externa" />
        </div>
      </section>
    </form>
  );
}

function DetailView({
  user,
  ticket,
  traces,
  isSubmitting,
  onAssign,
  onStatus,
  onFollowup,
  onTask,
  onCompleteTask,
  onResolve
}: {
  user: AppUser;
  ticket: Ticket;
  traces: TraceSpan[];
  isSubmitting: boolean;
  onAssign: () => void;
  onStatus: (status: TicketStatus) => void;
  onFollowup: (message: string, visibility: "public" | "internal") => void;
  onTask: (title: string, description?: string) => void;
  onCompleteTask: (taskId: string) => void;
  onResolve: (message: string) => void;
}) {
  const [followup, setFollowup] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [resolution, setResolution] = useState(ticket.ai.resolutionDraft?.summary ?? "");
  const canWork = user.role !== "requester";

  return (
    <section className="detail-layout" aria-label="Detalhe do chamado">
      <div className="detail-header panel">
        <div>
          <p className="eyebrow">{ticket.number} · {typeLabel(ticket.type)}</p>
          <h2>{ticket.title}</h2>
          <p>{ticket.requesterEmail} · {ticket.affectedService}</p>
        </div>
        <div className="header-badges">
          <Badge tone={priorityTone(ticket.priority)}>{priorityLabel(ticket.priority)}</Badge>
          <select className="status-select" value={ticket.status} disabled={!canWork || isSubmitting} onChange={(event) => onStatus(event.target.value as TicketStatus)}>
            <option value="open">Aberto</option>
            <option value="in_progress">Em atendimento</option>
            <option value="waiting_customer">Aguardando solicitante</option>
            <option value="pending_approval">Aguardando aprovacao</option>
            <option value="escalated">Escalado</option>
            <option value="resolved">Resolvido</option>
          </select>
        </div>
      </div>
      <div className="action-bar panel">
        <SlaBadge ticket={ticket} />
        <span>{ticket.assignedGroupName ?? "Sem grupo"}</span>
        <span>{ticket.assigneeName ?? "Nao atribuido"}</span>
        {canWork ? (
          <button type="button" className="secondary-button small" disabled={isSubmitting} onClick={onAssign}>
            <UserRound size={16} />
            <span>Atribuir para mim</span>
          </button>
        ) : null}
      </div>
      <div className="detail-grid">
        <section className="panel timeline-panel" aria-labelledby="timeline-title">
          <div className="panel-heading">
            <div>
              <h2 id="timeline-title">Acompanhamentos</h2>
              <p>Historico visivel e comentarios internos controlados por perfil.</p>
            </div>
          </div>
          <div className="timeline">
            {[...ticket.timeline, ...ticket.followups.map((item) => ({ id: item.id, actor: item.visibility === "internal" ? "technician" as const : "requester" as const, message: item.message, createdAt: item.createdAt }))].map((event) => (
              <article key={event.id} className={`timeline-item ${event.actor}`}>
                <span>{event.actor}</span>
                <p>{event.message}</p>
              </article>
            ))}
          </div>
          <div className="composer">
            <textarea value={followup} onChange={(event) => setFollowup(event.target.value)} placeholder="Registrar acompanhamento" />
            <div className="inline-actions end">
              {canWork ? (
                <button type="button" className="secondary-button small" disabled={isSubmitting || followup.trim().length < 3} onClick={() => { onFollowup(followup, "internal"); setFollowup(""); }}>
                  <span>Salvar interno</span>
                </button>
              ) : null}
              <button type="button" className="primary-button small" disabled={isSubmitting || followup.trim().length < 3} onClick={() => { onFollowup(followup, "public"); setFollowup(""); }}>
                <span>Publicar acompanhamento</span>
              </button>
            </div>
          </div>
        </section>
        <section className="panel context-panel" aria-labelledby="context-title">
          <div className="panel-heading">
            <div>
              <h2 id="context-title">Operacao</h2>
              <p>Contexto, tarefas e solucao.</p>
            </div>
          </div>
          <AnalysisItem label="Categoria" value={ticket.category} />
          <AnalysisItem label="Impacto" value={ticket.businessImpact} />
          <AnalysisItem label="Tags" value={ticket.tags.join(", ") || "Sem tags"} />
          <div className="task-list">
            <h3>Tarefas</h3>
            {ticket.tasks.length ? ticket.tasks.map((task) => (
              <label key={task.id} className="task-row">
                <input type="checkbox" checked={task.status === "done"} disabled={!canWork || task.status === "done"} onChange={() => onCompleteTask(task.id)} />
                <span>{task.title}</span>
              </label>
            )) : <p>Nenhuma tarefa registrada.</p>}
            {canWork ? (
              <div className="task-composer">
                <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Nova tarefa tecnica" />
                <button type="button" className="secondary-button small" disabled={isSubmitting || taskTitle.trim().length < 3} onClick={() => { onTask(taskTitle); setTaskTitle(""); }}>
                  <Plus size={16} />
                  <span>Criar tarefa</span>
                </button>
              </div>
            ) : null}
          </div>
          {canWork ? (
            <div className="resolution-box">
              <h3>Solucao</h3>
              <textarea value={resolution} onChange={(event) => setResolution(event.target.value)} />
              <button type="button" className="primary-button small" disabled={isSubmitting || resolution.trim().length < 6} onClick={() => onResolve(resolution)}>
                <CheckCircle2 size={16} />
                <span>Resolver chamado</span>
              </button>
            </div>
          ) : null}
        </section>
        <AgentRail ticket={ticket} traces={traces} />
      </div>
      <section className="panel evidence-panel" aria-labelledby="evidence-title">
        <div className="panel-heading">
          <div>
            <h2 id="evidence-title">IA, RAG e auditoria</h2>
            <p>Fontes, ferramentas e rastreabilidade da decisao.</p>
          </div>
          <Badge tone="info">Google via AI SDK</Badge>
        </div>
        <div className="evidence-grid">
          {ticket.ai.retrievedSources.length ? ticket.ai.retrievedSources.map((source) => (
            <article key={source.id} className="evidence-row">
              <div>
                <strong>{source.title}</strong>
                <span>{source.source}</span>
              </div>
              <p>{source.excerpt}</p>
              <Badge tone="neutral">{Math.round(source.relevance * 100)}%</Badge>
            </article>
          )) : <p className="empty-inline">Nenhuma fonte RAG vinculada.</p>}
        </div>
      </section>
    </section>
  );
}

function AgentRail({ ticket, traces }: { ticket?: Ticket; traces: TraceSpan[] }) {
  const triage = ticket?.ai.triage;
  const draft = ticket?.ai.resolutionDraft;
  const traceId = typeof triage?.metadata?.traceId === "string" ? triage.metadata.traceId : undefined;
  const visibleSpans = traceId ? traces.filter((span) => span.traceId === traceId).slice(0, 6) : traces.slice(0, 6);
  const steps = [
    { label: "Classificador", state: triage ? "done" : "waiting", icon: ClipboardList, meta: triage ? `${Math.round(triage.confidence * 100)}%` : "pendente" },
    { label: "RAG", state: ticket?.ai.retrievedSources.length ? "done" : "waiting", icon: FileSearch, meta: `${ticket?.ai.retrievedSources.length ?? 0} fontes` },
    { label: "Roteamento", state: ticket?.assignedGroupName ? "done" : "waiting", icon: UsersRound, meta: ticket?.assignedGroupName ?? "sem grupo" },
    { label: "Rascunho", state: draft ? "done" : "waiting", icon: Bot, meta: draft ? `${Math.round(draft.confidence * 100)}%` : "pendente" },
    { label: "Politica", state: "done", icon: ShieldCheck, meta: "humano aprova" }
  ];

  return (
    <aside className="panel agent-rail" aria-labelledby="agent-title">
      <div className="panel-heading">
        <div>
          <h2 id="agent-title">Agentes</h2>
          <p>Tool calls e spans por etapa.</p>
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
      <div className="trace-card">
        <h3>Rastreio</h3>
        <p className="trace-id">{traceId ?? "Sem trace vinculado"}</p>
        <div className="trace-list">
          {visibleSpans.length ? visibleSpans.map((span) => (
            <div className={`trace-row ${span.status}`} key={span.id}>
              <span>{span.kind}</span>
              <strong>{span.name}</strong>
              <small>{span.durationMs} ms</small>
            </div>
          )) : <small>Nenhum span registrado.</small>}
        </div>
      </div>
    </aside>
  );
}

function AdminView({ user, catalog }: { user: AppUser; catalog: ServiceDeskCatalog | null }) {
  if (user.role !== "admin") {
    return (
      <div className="panel empty-state">
        <ShieldCheck size={28} />
        <h3>Acesso restrito</h3>
        <p>Somente administradores podem ver usuarios, perfis, grupos e politicas.</p>
      </div>
    );
  }

  return (
    <section className="admin-grid">
      <AdminPanel title="Usuarios" icon={<UsersRound size={18} />}>
        {(catalog?.users ?? []).map((item) => (
          <div className="admin-row" key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <span>{item.email}</span>
            </div>
            <Badge tone="info">{roleLabel(item.role)}</Badge>
          </div>
        ))}
      </AdminPanel>
      <AdminPanel title="Grupos" icon={<LifeBuoy size={18} />}>
        {(catalog?.groups ?? []).map((group) => (
          <div className="admin-row" key={group.id}>
            <div>
              <strong>{group.name}</strong>
              <span>{group.services.join(", ")}</span>
            </div>
          </div>
        ))}
      </AdminPanel>
      <AdminPanel title="SLA" icon={<Clock3 size={18} />}>
        {(catalog?.slaPolicies ?? []).map((sla) => (
          <div className="admin-row" key={sla.id}>
            <div>
              <strong>{sla.name}</strong>
              <span>Resposta {sla.responseMinutes} min · Resolucao {sla.resolutionMinutes} min</span>
            </div>
            <Badge tone={priorityTone(sla.priority)}>{priorityLabel(sla.priority)}</Badge>
          </div>
        ))}
      </AdminPanel>
      <AdminPanel title="Base de conhecimento" icon={<BookOpen size={18} />}>
        {(catalog?.knowledgeArticles ?? []).map((article) => (
          <div className="admin-row" key={article.id}>
            <div>
              <strong>{article.title}</strong>
              <span>{article.source}</span>
            </div>
            <Badge tone="neutral">{article.category}</Badge>
          </div>
        ))}
      </AdminPanel>
    </section>
  );
}

function AdminPanel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="panel admin-panel">
      <div className="panel-heading">
        <div className="heading-inline">
          {icon}
          <h2>{title}</h2>
        </div>
      </div>
      <div className="admin-list">{children}</div>
    </section>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
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

function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function SlaBadge({ ticket }: { ticket: Ticket }) {
  const risk = slaRisk(ticket);
  const due = new Date(ticket.sla.resolutionDueAt);
  return <Badge tone={risk === "breached" ? "danger" : risk === "warning" ? "warning" : "success"}>{risk === "breached" ? "SLA vencido" : `${ticket.sla.label} · ${relativeDue(due)}`}</Badge>;
}

function SkeletonRows() {
  return (
    <div className="skeleton-rows" aria-label="Carregando chamados">
      {Array.from({ length: 7 }).map((_, index) => <span key={index} />)}
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function estimatedPriority(form: CreateTicketPayload): TicketPriority {
  const score = priorityScore(form.urgency) + priorityScore(form.impact);
  if (score >= 7) return "critical";
  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  return "low";
}

function estimatedGroup(form: CreateTicketPayload) {
  const text = `${form.affectedService} ${form.title} ${form.description}`.toLowerCase();
  if (/vpn|rede|wi-fi|conexao/.test(text)) return "N2 Redes e Conectividade";
  if (/mfa|senha|login|acesso|sso/.test(text)) return "N1 Identidade e Acesso";
  if (/erp|faturamento|fiscal|nota/.test(text)) return "N2 ERP e Financeiro";
  return "N3 Plataforma e Integracoes";
}

function priorityScore(priority: TicketPriority) {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function slaRisk(ticket: Ticket): "ok" | "warning" | "breached" {
  if (ticket.status === "resolved" || ticket.status === "closed") return "ok";
  const due = Date.parse(ticket.sla.resolutionDueAt);
  const remaining = due - Date.now();
  if (remaining <= 0 || ticket.sla.breached) return "breached";
  if (remaining <= 60 * 60 * 1000) return "warning";
  return "ok";
}

function relativeDue(due: Date) {
  const minutes = Math.round((due.getTime() - Date.now()) / 60_000);
  if (minutes < 0) return "vencido";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}

function roleLabel(role: string) {
  if (role === "admin") return "Administrador";
  if (role === "supervisor") return "Supervisor";
  if (role === "technician") return "Tecnico";
  return "Solicitante";
}

function typeLabel(type: string) {
  return type === "request" ? "Solicitacao" : "Incidente";
}

function priorityLabel(priority: string) {
  if (priority === "critical") return "Critica";
  if (priority === "high") return "Alta";
  if (priority === "medium") return "Media";
  return "Baixa";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    new: "Novo",
    open: "Aberto",
    triaging: "Triagem",
    in_progress: "Em atendimento",
    waiting_customer: "Aguardando solicitante",
    pending_approval: "Aguardando aprovacao",
    escalated: "Escalado",
    resolved: "Resolvido",
    closed: "Fechado"
  };
  return labels[status] ?? status;
}

function priorityTone(priority: string) {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warning";
  if (priority === "medium") return "info";
  return "neutral";
}

function statusTone(status: string) {
  if (status === "resolved" || status === "closed") return "success";
  if (status === "escalated") return "danger";
  if (status === "waiting_customer" || status === "pending_approval") return "warning";
  if (status === "triaging" || status === "in_progress") return "info";
  return "neutral";
}
