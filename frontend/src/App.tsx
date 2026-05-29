import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  useMessage,
  type AppendMessage,
  type ThreadMessageLike
} from "@assistant-ui/react";
import { CopilotKit, CopilotPopup } from "@copilotkit/react-core/v2";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Bot,
  ChevronLeft,
  ChevronRight,
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
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  TicketCheck,
  Trash2,
  UserRound,
  UserPlus,
  UsersRound,
  X
} from "lucide-react";
import {
  addFollowup,
  addTask,
  assignTicket,
  assessTicketIntake,
  createUser,
  completeTask,
  createTicket,
  deleteTicket,
  getCatalog,
  getSession,
  listAgentTraces,
  listTickets,
  login,
  logout,
  resolveTicket,
  streamTicketChat,
  updateProfile,
  updateTicketStatus,
  updateUser,
  type AppUser,
  type CreateUserPayload,
  type CreateTicketPayload,
  type IntakeAssessment,
  type ServiceDeskCatalog,
  type Ticket,
  type TicketAgentMemoryEntry,
  type TicketChatStreamEvent,
  type TicketPriority,
  type TicketStatus,
  type TraceSpan
} from "./lib/api";

type View = "queue" | "new" | "detail" | "admin" | "profile";

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

const copilotRuntimeUrl = import.meta.env.VITE_COPILOT_RUNTIME_URL ?? "/api/copilotkit";

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
  const [isAssessing, setIsAssessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [form, setForm] = useState<CreateTicketPayload>(initialForm);
  const [intakeAssessment, setIntakeAssessment] = useState<IntakeAssessment | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => window.innerWidth < 920);

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
    try {
      await logout();
    } catch {
      // Mesmo se a sessao ja expirou, o estado local precisa voltar para a tela de login.
    }
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
      const assessment = await runIntakeAssessment(payload);
      if (!assessment.shouldCreate) {
        setError(assessment.blockedReason ?? assessment.summary);
        return;
      }
      const ticket = await createTicket(payload);
      setTickets((current) => [ticket, ...current]);
      setSelectedId(ticket.id);
      setView("detail");
      setForm({ ...initialForm, requesterEmail: user.email });
      setIntakeAssessment(null);
      void refreshWorkspace();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel criar o chamado.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function runIntakeAssessment(payload: CreateTicketPayload): Promise<IntakeAssessment> {
    setIsAssessing(true);
    try {
      const assessment = await assessTicketIntake(payload);
      setIntakeAssessment(assessment);
      return assessment;
    } finally {
      setIsAssessing(false);
    }
  }

  async function handleAssessIntake() {
    if (!user) return;
    setError(null);
    try {
      const payload = user.role === "requester" ? { ...form, requesterEmail: user.email } : form;
      await runIntakeAssessment(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel analisar o chamado.");
    }
  }

  function updateForm(next: CreateTicketPayload) {
    setForm(next);
    setIntakeAssessment(null);
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

  async function handleDeleteTicket(ticket: Ticket) {
    const confirmed = window.confirm(`Excluir o chamado ${ticket.number}? Esta acao remove o registro da fila.`);
    if (!confirmed) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await deleteTicket(ticket.id);
      setTickets((current) => current.filter((item) => item.id !== ticket.id));
      setSelectedId(null);
      setView("queue");
      void refreshWorkspace();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel excluir o chamado.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleTicketUpdated(ticket: Ticket) {
    setTickets((current) => current.map((item) => (item.id === ticket.id ? ticket : item)));
    setSelectedId(ticket.id);
  }

  async function handleTicketChatStream(
    ticket: Ticket,
    message: string,
    onEvent: (event: TicketChatStreamEvent) => void
  ) {
    await streamTicketChat(ticket.id, message, (event) => {
      onEvent(event);
      if (event.type === "ticket") {
        handleTicketUpdated(event.ticket);
        void refreshWorkspace();
      }
    });
  }

  async function handleCurrentUserUpdated(updated: AppUser) {
    setUser(updated);
    await refreshWorkspace();
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
    <CopilotKit key={user.id} runtimeUrl={copilotRuntimeUrl} credentials="include" showDevConsole={false}>
      <div className="app-shell">
        <Sidebar
          user={user}
          active={view}
          collapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed((current) => !current)}
          onNavigate={(nextView) => {
            setView(nextView);
            if (window.innerWidth < 920) setIsSidebarCollapsed(true);
          }}
          onLogout={() => void handleLogout()}
        />
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
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
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
              setForm={updateForm}
              assessment={intakeAssessment}
              isAssessing={isAssessing}
              isSubmitting={isSubmitting}
              onAssess={() => void handleAssessIntake()}
              onSubmit={handleCreateTicket}
            />
          ) : null}

          {view === "detail" && selectedTicket ? (
            <DetailView
              user={user}
              ticket={selectedTicket}
              isSubmitting={isSubmitting}
              onAssign={() => mutateTicket(() => assignTicket(selectedTicket.id))}
              onStatus={(status) => mutateTicket(() => updateTicketStatus(selectedTicket.id, status))}
              onFollowup={(message, visibility) => mutateTicket(() => addFollowup(selectedTicket.id, message, visibility))}
              onTask={(title, description) => mutateTicket(() => addTask(selectedTicket.id, title, description))}
              onCompleteTask={(taskId) => mutateTicket(() => completeTask(selectedTicket.id, taskId))}
              onResolve={(message) => mutateTicket(() => resolveTicket(selectedTicket.id, message))}
              onDelete={() => void handleDeleteTicket(selectedTicket)}
              onTicketUpdated={handleTicketUpdated}
              onChat={(message, onEvent) => handleTicketChatStream(selectedTicket, message, onEvent)}
            />
          ) : null}

          {view === "profile" ? <ProfileView user={user} onUpdated={(updated) => void handleCurrentUserUpdated(updated)} /> : null}

          {view === "admin" ? (
            <AdminView
              user={user}
              catalog={catalog}
              onUserSaved={(updated) => {
                if (updated.id === user.id) setUser(updated);
                void refreshWorkspace();
              }}
            />
          ) : null}
        </main>
      </div>
      <CopilotPopup
        defaultOpen={false}
        width={420}
        height={620}
        labels={{
          modalHeaderTitle: "Copiloto de chamados",
          welcomeMessageText: "Posso listar chamados, prever triagem ou criar um chamado com rastreio.",
          chatInputPlaceholder: "Pergunte sobre SLA, fila ou abertura de chamado..."
        }}
        attachments={{ enabled: true, accept: "image/*", maxSize: 2 * 1024 * 1024 }}
      />
    </CopilotKit>
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
  const testRequesterEmail = "solicitante.teste@empresa.local";
  const testRequesterPassword = "ChamadosTeste@2026!";

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
        <button
          type="button"
          className="secondary-button wide"
          onClick={() => {
            setEmail(testRequesterEmail);
            setPassword(testRequesterPassword);
          }}
        >
          <UserRound size={18} />
          <span>Usar conta teste</span>
        </button>
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
  collapsed,
  onToggle,
  onNavigate,
  onLogout
}: {
  user: AppUser;
  active: View;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate: (view: View) => void;
  onLogout: () => void;
}) {
  const requester = user.role === "requester";
  const items = [
    { id: "queue" as const, label: requester ? "Meus chamados" : "Minha fila", icon: ClipboardList },
    { id: "new" as const, label: "Abrir chamado", icon: Plus },
    ...(requester ? [] : [{ id: "detail" as const, label: "Workspace", icon: TicketCheck }]),
    ...(user.role === "admin" ? [{ id: "admin" as const, label: "Administracao", icon: Settings }] : []),
    { id: "profile" as const, label: "Perfil", icon: UserRound }
  ];

  return (
    <aside className={collapsed ? "sidebar collapsed" : "sidebar"}>
      <div className="brand">
        <div className="brand-mark">
          <Bot size={20} />
        </div>
        <div>
          <strong>Service Desk IA</strong>
          <span>{user.entityName}</span>
        </div>
        <button type="button" className="sidebar-toggle" onClick={onToggle} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
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
        <button type="button" className="user-block user-block-button" onClick={() => onNavigate("profile")}>
          <UserRound size={18} />
          <div>
            <strong>{user.name}</strong>
            <span>{roleLabel(user.role)}</span>
          </div>
        </button>
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
  isLoading,
  isSidebarCollapsed,
  onToggleSidebar
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
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
  const title =
    view === "new"
      ? "Abrir chamado"
      : view === "detail"
        ? "Workspace do chamado"
        : view === "admin"
          ? "Administracao"
          : view === "profile"
            ? "Perfil"
            : user.role === "requester"
              ? "Meus chamados"
              : "Minha fila";

  return (
    <header className="topbar">
      <button type="button" className="icon-button mobile-menu-button" onClick={onToggleSidebar} aria-label={isSidebarCollapsed ? "Abrir menu" : "Recolher menu"}>
        <Menu size={18} />
      </button>
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
  isLoading,
  selectedId,
  onSelect
}: {
  tickets: Ticket[];
  allTickets: Ticket[];
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
  assessment,
  isAssessing,
  isSubmitting,
  onAssess,
  onSubmit
}: {
  user: AppUser;
  form: CreateTicketPayload;
  setForm: (form: CreateTicketPayload) => void;
  assessment: IntakeAssessment | null;
  isAssessing: boolean;
  isSubmitting: boolean;
  onAssess: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const remainingAttachments = MAX_ATTACHMENTS - form.attachments.length;
  const shouldBlockCreate = Boolean(assessment && !assessment.shouldCreate);

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
          <Field label="Impacto operacional">
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
          <button type="button" className="secondary-button" disabled={isSubmitting || isAssessing} onClick={onAssess}>
            {isAssessing ? <Loader2 className="spin" size={18} /> : <FileSearch size={18} />}
            <span>Analisar chamado</span>
          </button>
          <button type="submit" className="primary-button" disabled={isSubmitting || isAssessing || shouldBlockCreate}>
            {isSubmitting ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
            <span>Criar chamado</span>
          </button>
        </div>
      </section>
      <IntakeIntelligencePanel
        form={form}
        assessment={assessment}
        isAssessing={isAssessing}
        onApplySuggestion={() => {
          if (!assessment) return;
          setForm({
            ...form,
            type: assessment.suggestedFields.type,
            title: assessment.suggestedFields.title ?? form.title,
            affectedService: assessment.suggestedFields.affectedService,
            urgency: assessment.suggestedFields.urgency,
            impact: assessment.suggestedFields.impact
          });
        }}
      />
    </form>
  );
}

function IntakeIntelligencePanel({
  form,
  assessment,
  isAssessing,
  onApplySuggestion
}: {
  form: CreateTicketPayload;
  assessment: IntakeAssessment | null;
  isAssessing: boolean;
  onApplySuggestion: () => void;
}) {
  const localPriority = estimatedPriority(form);

  return (
    <section className="panel ai-panel" aria-labelledby="intake-ai-title">
      <div className="panel-heading">
        <div>
          <h2 id="intake-ai-title">Intake inteligente</h2>
          <p>Analise antes da abertura com RAG, similares, campos sugeridos e bloqueio de chamados vagos.</p>
        </div>
        {assessment ? <Badge tone={assessmentTone(assessment)}>{readinessLabel(assessment.readiness)}</Badge> : null}
      </div>
      {isAssessing ? (
        <div className="analysis-list">
          <div className="intake-loading">
            <Loader2 className="spin" size={18} />
            <span>Analisando qualidade, RAG e similares</span>
          </div>
          <SkeletonRows />
        </div>
      ) : assessment ? (
        <div className="analysis-list">
          <div className="quality-block">
            <div className="quality-header">
              <strong>{assessment.qualityScore}/100</strong>
              <span>{assessment.summary}</span>
            </div>
            <div className="quality-meter" aria-label={`Qualidade do chamado ${assessment.qualityScore} de 100`}>
              <span style={{ width: `${assessment.qualityScore}%` }} />
            </div>
          </div>

          {assessment.selfService.canDeflect ? (
            <div className="self-service-box">
              <div className="heading-inline">
                <BookOpen size={17} />
                <h3>Autoatendimento encontrado</h3>
              </div>
              <p>{assessment.selfService.answer}</p>
            </div>
          ) : null}

          {assessment.missingInformation.length ? (
            <div className="intake-list">
              <h3>Faltando para abrir</h3>
              <ul>
                {assessment.missingInformation.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {assessment.clarificationQuestions.length ? (
            <div className="intake-list">
              <h3>Perguntas sugeridas</h3>
              <ul>
                {assessment.clarificationQuestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="suggestion-card">
            <div>
              <strong>{assessment.suggestedFields.category}</strong>
              <span>{priorityLabel(assessment.suggestedFields.priority)} · {assessment.suggestedFields.assignedGroupName}</span>
            </div>
            <button type="button" className="secondary-button small" onClick={onApplySuggestion}>
              <CheckCircle2 size={16} />
              <span>Aplicar sugestao</span>
            </button>
          </div>

          <div className="quality-signals">
            {assessment.qualitySignals.map((signal) => (
              <div className={`quality-signal ${signal.status}`} key={signal.label}>
                {signal.status === "ok" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                <div>
                  <strong>{signal.label}</strong>
                  <span>{signal.detail}</span>
                </div>
              </div>
            ))}
          </div>

          {assessment.ragSources.length ? (
            <div className="intake-list">
              <h3>RAG usado</h3>
              {assessment.ragSources.slice(0, 3).map((source) => (
                <article className="compact-source" key={source.id}>
                  <strong>{source.title}</strong>
                  <span>{source.source} · {Math.round(source.relevance * 100)}%</span>
                </article>
              ))}
            </div>
          ) : null}

          {assessment.similarTickets.length ? (
            <div className="intake-list">
              <h3>Chamados parecidos</h3>
              {assessment.similarTickets.map((ticket) => (
                <article className="compact-source" key={ticket.id}>
                  <strong>{ticket.number} · {ticket.title}</strong>
                  <span>{statusLabel(ticket.status)} · {ticket.affectedService} · {Math.round(ticket.score * 100)}%</span>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="analysis-list">
          <AnalysisItem label="Prioridade local" value={priorityLabel(localPriority)} />
          <AnalysisItem label="SLA local" value={localPriority === "critical" ? "P1 - resposta em 15 min" : localPriority === "high" ? "P2 - resposta em 1 h" : "P3/P4 - fila padrao"} />
          <AnalysisItem label="Grupo local" value={estimatedGroup(form)} />
          <AnalysisItem label="Controle" value="A analise IA roda antes de criar o chamado" />
        </div>
      )}
    </section>
  );
}

function DetailView({
  user,
  ticket,
  isSubmitting,
  onAssign,
  onStatus,
  onFollowup,
  onTask,
  onCompleteTask,
  onResolve,
  onDelete,
  onTicketUpdated,
  onChat
}: {
  user: AppUser;
  ticket: Ticket;
  isSubmitting: boolean;
  onAssign: () => void;
  onStatus: (status: TicketStatus) => void;
  onFollowup: (message: string, visibility: "public" | "internal") => void;
  onTask: (title: string, description?: string) => void;
  onCompleteTask: (taskId: string) => void;
  onResolve: (message: string) => void;
  onDelete: () => void;
  onTicketUpdated: (ticket: Ticket) => void;
  onChat: (message: string, onEvent: (event: TicketChatStreamEvent) => void) => Promise<void>;
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
        {user.role === "admin" ? (
          <button type="button" className="danger-button small" disabled={isSubmitting} onClick={onDelete}>
            <Trash2 size={16} />
            <span>Excluir chamado</span>
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
      </div>
      <TicketAssistantChat ticket={ticket} onTicketUpdated={onTicketUpdated} onChat={onChat} />
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

function TicketAssistantChat({
  ticket,
  onTicketUpdated,
  onChat
}: {
  ticket: Ticket;
  onTicketUpdated: (ticket: Ticket) => void;
  onChat: (message: string, onEvent: (event: TicketChatStreamEvent) => void) => Promise<void>;
}) {
  const specialistMemory = useMemo(
    () => (ticket.ai.agentMemory ?? []).filter((entry) => entry.agent === "ticket-specialist" && entry.role !== "system"),
    [ticket.ai.agentMemory]
  );
  const [liveMessages, setLiveMessages] = useState<TicketAgentMemoryEntry[]>(specialistMemory);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState("Pronto para conversar com o agente.");

  useEffect(() => {
    if (!isStreaming) setLiveMessages(specialistMemory);
  }, [isStreaming, specialistMemory]);

  const runtime = useExternalStoreRuntime<TicketAgentMemoryEntry>({
    messages: liveMessages,
    isRunning: isStreaming,
    isSendDisabled: isStreaming,
    convertMessage: convertSpecialistMemory,
    onNew: async (message: AppendMessage) => {
      const text = appendMessageToText(message);
      if (!text) return;
      const now = new Date().toISOString();
      const userMessage = buildTemporaryMemory(ticket, "user", "Voce", "current-user", text, now);
      const assistantMessage = buildTemporaryMemory(ticket, "assistant", "Agente especialista", "ticket-specialist", "", now);
      setLiveMessages([...specialistMemory, userMessage, assistantMessage]);
      setIsStreaming(true);
      setStreamStatus("Enviando mensagem e preparando contexto.");

      try {
        await onChat(text, (event) => {
          if (event.type === "status") {
            setStreamStatus(event.model ? `${event.message} Modelo: ${event.model}` : event.message);
            return;
          }

          if (event.type === "delta") {
            setStreamStatus(`Respondendo com ${event.model}.`);
            setLiveMessages((current) =>
              current.map((item) =>
                item.id === assistantMessage.id ? { ...item, content: `${item.content}${event.text}` } : item
              )
            );
            return;
          }

          if (event.type === "error") {
            setStreamStatus(event.message);
            setLiveMessages((current) =>
              current.map((item) =>
                item.id === assistantMessage.id && !item.content
                  ? { ...item, content: `Nao consegui concluir a resposta agora. ${event.message}` }
                  : item
              )
            );
            return;
          }

          const persistedMessages = event.messages.filter((entry) => entry.agent === "ticket-specialist" && entry.role !== "system");
          setLiveMessages(persistedMessages);
          onTicketUpdated(event.ticket);
          setStreamStatus("Resposta salva na memoria do chamado.");
        });
      } catch (cause) {
        const messageText = cause instanceof Error ? cause.message : "Falha ao conversar com o agente.";
        setStreamStatus(messageText);
        setLiveMessages((current) =>
          current.map((item) =>
            item.id === assistantMessage.id ? { ...item, content: `Erro no chat: ${messageText}` } : item
          )
        );
      } finally {
        setIsStreaming(false);
      }
    }
  });

  return (
    <section className="panel assistant-chat-panel" aria-labelledby="ticket-chat-title">
      <div className="panel-heading">
        <div>
          <h2 id="ticket-chat-title">Chat do chamado</h2>
          <p>Agente especialista Mastra com memoria do chamado, RAG e contexto da fila autorizada.</p>
        </div>
        <Badge tone="info">assistant-ui</Badge>
      </div>
      <div className="stream-status" aria-live="polite">
        {isStreaming ? <Loader2 className="spin" size={15} /> : <Bot size={15} />}
        <span>{streamStatus}</span>
      </div>
      <AssistantRuntimeProvider runtime={runtime}>
        <ThreadPrimitive.Root className="assistant-thread">
          <ThreadPrimitive.Viewport className="assistant-viewport">
            <ThreadPrimitive.Empty>
              <div className="assistant-empty">
                <Bot size={22} />
                <strong>Pergunte sobre diagnostico, SLA, proximos passos ou resposta ao solicitante.</strong>
                <span>O agente usa este chamado, os chamados acessiveis e a memoria ja registrada.</span>
              </div>
            </ThreadPrimitive.Empty>
            <ThreadPrimitive.Messages components={{ Message: AssistantThreadMessage }} />
            <ThreadPrimitive.ViewportFooter>
              <ComposerPrimitive.Root className="assistant-composer">
                <ComposerPrimitive.Input
                  className="assistant-input"
                  placeholder="Converse com o agente especialista deste chamado"
                  submitMode="ctrlEnter"
                  rows={2}
                />
                <ComposerPrimitive.Send className="primary-button small assistant-send">
                  {isStreaming ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                  <span>Enviar</span>
                </ComposerPrimitive.Send>
              </ComposerPrimitive.Root>
            </ThreadPrimitive.ViewportFooter>
          </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
      </AssistantRuntimeProvider>
    </section>
  );
}

function AssistantThreadMessage() {
  const role = useMessage((message) => message.role);
  return (
    <MessagePrimitive.Root className={`assistant-message ${role}`}>
      <div className="assistant-message-meta">{role === "assistant" ? "Agente especialista" : "Voce"}</div>
      <div className="assistant-message-bubble">
        <MessagePrimitive.Parts components={{ Text: AssistantMessageText }} />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessageText() {
  return (
    <p>
      <MessagePartPrimitive.Text />
    </p>
  );
}

function convertSpecialistMemory(message: TicketAgentMemoryEntry): ThreadMessageLike {
  return {
    id: message.id,
    role: message.role === "assistant" ? "assistant" : "user",
    content: [{ type: "text", text: message.content }],
    createdAt: new Date(message.createdAt)
  };
}

function appendMessageToText(message: AppendMessage): string {
  return message.content
    .map((part) => ("text" in part ? part.text : ""))
    .join("\n")
    .trim();
}

function buildTemporaryMemory(
  ticket: Ticket,
  role: "user" | "assistant",
  actorName: string,
  actorId: string,
  content: string,
  createdAt: string
): TicketAgentMemoryEntry {
  return {
    id: `tmp-${role}-${createdAt}-${Math.random().toString(36).slice(2)}`,
    ticketId: ticket.id,
    agent: "ticket-specialist",
    role,
    actorId,
    actorName,
    content,
    createdAt,
    contextTicketIds: [ticket.id]
  };
}

function AgentRail({ ticket, traces }: { ticket?: Ticket; traces: TraceSpan[] }) {
  const triage = ticket?.ai.triage;
  const draft = ticket?.ai.resolutionDraft;
  const traceId = typeof triage?.metadata?.traceId === "string" ? triage.metadata.traceId : undefined;
  const visibleSpans = traceId ? traces.filter((span) => span.traceId === traceId).slice(0, 6) : traces.slice(0, 6);
  const intakeQuality = triage?.metadata?.intakeQuality as { qualityScore?: number; readiness?: string } | undefined;
  const steps = [
    { label: "Intake", state: intakeQuality ? "done" : "waiting", icon: FileSearch, meta: intakeQuality?.qualityScore ? `${intakeQuality.qualityScore}/100` : "pendente" },
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

function ProfileView({ user, onUpdated }: { user: AppUser; onUpdated: (user: AppUser) => void }) {
  const [name, setName] = useState(user.name);
  const [entityName, setEntityName] = useState(user.entityName);
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await updateProfile({
        name,
        entityName,
        password: password.trim() ? password : undefined
      });
      setPassword("");
      onUpdated(response.user);
      setMessage("Perfil atualizado.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Nao foi possivel atualizar o perfil.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="profile-layout" onSubmit={submit}>
      <section className="panel profile-panel" aria-labelledby="profile-title">
        <div className="panel-heading">
          <div>
            <h2 id="profile-title">Meu perfil</h2>
            <p>Edite dados exibidos no portal e altere a senha de acesso.</p>
          </div>
          <Badge tone="info">{roleLabel(user.role)}</Badge>
        </div>
        {message ? <div className="inline-alert compact" role="status">{message}</div> : null}
        <div className="form-grid">
          <Field label="Nome" wide>
            <input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="E-mail" wide>
            <input disabled value={user.email} />
          </Field>
          <Field label="Entidade" wide>
            <input required minLength={2} value={entityName} onChange={(event) => setEntityName(event.target.value)} />
          </Field>
          <Field label="Nova senha" wide>
            <input
              type="password"
              minLength={8}
              autoComplete="new-password"
              placeholder="Deixe em branco para manter a senha atual"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
        </div>
        <div className="sticky-actions">
          <button type="submit" className="primary-button" disabled={isSaving}>
            {isSaving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
            <span>Salvar perfil</span>
          </button>
        </div>
      </section>
    </form>
  );
}

function AdminView({
  user,
  catalog,
  onUserSaved
}: {
  user: AppUser;
  catalog: ServiceDeskCatalog | null;
  onUserSaved: (user: AppUser) => void;
}) {
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
        <CreateUserForm catalog={catalog} onUserSaved={onUserSaved} />
        {(catalog?.users ?? []).map((item) => (
          <UserEditorRow key={item.id} item={item} catalog={catalog} onUserSaved={onUserSaved} />
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

function CreateUserForm({
  catalog,
  onUserSaved
}: {
  catalog: ServiceDeskCatalog | null;
  onUserSaved: (user: AppUser) => void;
}) {
  const [form, setForm] = useState<CreateUserPayload>({
    email: "",
    name: "",
    role: "requester",
    entityId: "corp",
    entityName: "Corporativo",
    groupIds: [],
    active: true,
    password: ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await createUser(form);
      onUserSaved(response.user);
      setForm({ ...form, email: "", name: "", password: "", groupIds: [] });
      setMessage("Usuario criado.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Nao foi possivel criar o usuario.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="user-create-form" onSubmit={submit}>
      <div className="admin-form-heading">
        <UserPlus size={17} />
        <strong>Criar usuario</strong>
      </div>
      {message ? <span className="form-note">{message}</span> : null}
      <div className="admin-form-grid">
        <Field label="Nome">
          <input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </Field>
        <Field label="E-mail">
          <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </Field>
        <Field label="Perfil">
          <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AppUser["role"], groupIds: event.target.value === "requester" ? [] : form.groupIds })}>
            {roleOptions().map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
          </select>
        </Field>
        <Field label="Senha">
          <input required type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        </Field>
      </div>
      <GroupCheckboxes
        groups={catalog?.groups ?? []}
        selected={form.groupIds ?? []}
        disabled={form.role === "requester"}
        onChange={(groupIds) => setForm({ ...form, groupIds })}
      />
      <button type="submit" className="primary-button small" disabled={isSaving}>
        {isSaving ? <Loader2 className="spin" size={16} /> : <UserPlus size={16} />}
        <span>Criar usuario</span>
      </button>
    </form>
  );
}

function UserEditorRow({
  item,
  catalog,
  onUserSaved
}: {
  item: AppUser;
  catalog: ServiceDeskCatalog | null;
  onUserSaved: (user: AppUser) => void;
}) {
  const [name, setName] = useState(item.name);
  const [email, setEmail] = useState(item.email);
  const [role, setRole] = useState(item.role);
  const [active, setActive] = useState(item.active);
  const [groupIds, setGroupIds] = useState(item.groupIds);
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await updateUser(item.id, {
        name,
        email,
        role,
        active,
        groupIds,
        password: password.trim() ? password : undefined
      });
      setPassword("");
      onUserSaved(response.user);
      setMessage("Salvo.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Nao foi possivel salvar.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="admin-row user-editor-row">
      <div className="user-editor-main">
        <div className="admin-form-grid">
          <Field label="Nome">
            <input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="E-mail">
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Perfil">
            <select value={role} onChange={(event) => {
              const nextRole = event.target.value as AppUser["role"];
              setRole(nextRole);
              if (nextRole === "requester") setGroupIds([]);
            }}>
              {roleOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="Nova senha">
            <input type="password" minLength={8} placeholder="Manter atual" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
        </div>
        <GroupCheckboxes
          groups={catalog?.groups ?? []}
          selected={groupIds}
          disabled={role === "requester"}
          onChange={setGroupIds}
        />
      </div>
      <div className="user-editor-actions">
        <label className="switch-row">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          <span>Ativo</span>
        </label>
        {message ? <span className="form-note">{message}</span> : null}
        <button type="button" className="secondary-button small" disabled={isSaving} onClick={() => void save()}>
          {isSaving ? <Loader2 className="spin" size={16} /> : <Pencil size={16} />}
          <span>Salvar</span>
        </button>
      </div>
    </div>
  );
}

function GroupCheckboxes({
  groups,
  selected,
  disabled,
  onChange
}: {
  groups: ServiceDeskCatalog["groups"];
  selected: string[];
  disabled: boolean;
  onChange: (groupIds: string[]) => void;
}) {
  return (
    <fieldset className="group-checkboxes" disabled={disabled}>
      <legend>Grupos de atendimento</legend>
      {groups.map((group) => (
        <label key={group.id}>
          <input
            type="checkbox"
            checked={selected.includes(group.id)}
            onChange={(event) => {
              const next = event.target.checked
                ? [...selected, group.id]
                : selected.filter((groupId) => groupId !== group.id);
              onChange(next);
            }}
          />
          <span>{group.name}</span>
        </label>
      ))}
    </fieldset>
  );
}

function roleOptions(): Array<{ value: AppUser["role"]; label: string }> {
  return [
    { value: "requester", label: "Solicitante" },
    { value: "technician", label: "Tecnico" },
    { value: "supervisor", label: "Supervisor" },
    { value: "admin", label: "Administrador" }
  ];
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

function readinessLabel(readiness: string) {
  if (readiness === "ready") return "Pronto";
  if (readiness === "self_service") return "Autoatendimento";
  return "Pedir dados";
}

function assessmentTone(assessment: IntakeAssessment) {
  if (assessment.readiness === "ready") return "success";
  if (assessment.readiness === "self_service") return "info";
  return "warning";
}
