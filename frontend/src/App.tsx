import { FormEvent, Suspense, lazy, useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  addFollowup,
  addTask,
  assignTicket,
  assessTicketIntake,
  completeTask,
  createTicket,
  decideTicketApproval,
  deleteTicket,
  getCatalog,
  getSession,
  listAgentEvalReport,
  listAgentRuns,
  listAgentTraces,
  listTickets,
  login,
  logout,
  recordAiFeedback,
  resolveTicket,
  streamTicketChat,
  updateTicketStatus,
  type AgentAuditEntry,
  type AppUser,
  type CreateTicketPayload,
  type IntakeAssessment,
  type ServiceDeskCatalog,
  type ServiceDeskEvalReport,
  type Ticket,
  type TicketChatStreamEvent,
  type TicketPriority,
  type TicketStatus,
  type TraceSpan
} from "./lib/api";
import {
  canOpenTicketForOthers,
  initialForm,
  slaRisk,
  type View
} from "./lib/presentation";
import { Sidebar, Topbar, type AiConfidenceFilter, type SlaRiskFilter, type ThemePreference } from "./components/AppChrome";
import { BootScreen, CopilotLoadingFallback, LoginScreen } from "./components/AppStateScreens";
import { QueueView as TicketQueueView } from "./views/tickets/QueueView";
import { IntakeView as TicketIntakeView } from "./views/tickets/IntakeView";
import { DashboardView } from "./views/tickets/DashboardView";
import { TicketWorkspaceView } from "./views/tickets/TicketWorkspaceView";
import { GovernanceView } from "./views/agents/GovernanceView";
import { ProfileView, UserCreatePage, UserDetailPage, UserDirectoryView } from "./views/admin/UserManagementViews";

const copilotRuntimeUrl = import.meta.env.VITE_COPILOT_RUNTIME_URL ?? "/api/copilotkit";
const CopilotWorkspace = lazy(() => import("./components/CopilotWorkspace"));

const THEME_STORAGE_KEY = "asid-theme";

function getInitialThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "system" || stored === "light" || stored === "dark" ? stored : "system";
}

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [traces, setTraces] = useState<TraceSpan[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentAuditEntry[]>([]);
  const [agentEvalReport, setAgentEvalReport] = useState<ServiceDeskEvalReport | null>(null);
  const [catalog, setCatalog] = useState<ServiceDeskCatalog | null>(null);
  const [copilotLaunchKey, setCopilotLaunchKey] = useState(0);
  const [isBooting, setIsBooting] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAssessing, setIsAssessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "all">("all");
  const [slaRiskFilter, setSlaRiskFilter] = useState<SlaRiskFilter>("all");
  const [confidenceFilter, setConfidenceFilter] = useState<AiConfidenceFilter>("all");
  const [form, setForm] = useState<CreateTicketPayload>(initialForm);
  const [intakeAssessment, setIntakeAssessment] = useState<IntakeAssessment | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => window.innerWidth < 920);
  const [themeMode, setThemeMode] = useState<ThemePreference>(getInitialThemePreference);

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 920) setIsSidebarCollapsed(true);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function applyTheme() {
      const resolved = themeMode === "dark" || (themeMode === "system" && media.matches) ? "dark" : "light";
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.themePreference = themeMode;
      document.documentElement.style.colorScheme = resolved;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [themeMode]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0],
    [selectedId, tickets]
  );

  const visibleTickets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
      const matchesSla = slaRiskFilter === "all" || slaRisk(ticket) === slaRiskFilter;
      const confidence = ticket.ai.triage?.confidence ?? 0;
      const matchesConfidence =
        confidenceFilter === "all" ||
        (confidenceFilter === "low" ? confidence < 0.72 : confidence >= 0.72);
      const matchesTerm =
        !term ||
        [ticket.number, ticket.title, ticket.requesterEmail, ticket.affectedService, ticket.assignedGroupName, ticket.assigneeName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      return matchesStatus && matchesPriority && matchesSla && matchesConfidence && matchesTerm;
    });
  }, [confidenceFilter, priorityFilter, search, slaRiskFilter, statusFilter, tickets]);

  function resetQueueFilters(nextStatus: TicketStatus | "all" = "all") {
    setSearch("");
    setStatusFilter(nextStatus);
    setPriorityFilter("all");
    setSlaRiskFilter("all");
    setConfidenceFilter("all");
  }

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
      const [loadedTickets, loadedTraces, loadedAgentRuns, loadedEvalReport, loadedCatalog] = await Promise.all([
        listTickets(),
        listAgentTraces(),
        listAgentRuns(),
        listAgentEvalReport().catch(() => null),
        getCatalog()
      ]);
      setTickets(loadedTickets);
      setTraces(loadedTraces);
      setAgentRuns(loadedAgentRuns);
      setAgentEvalReport(loadedEvalReport);
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
    setSelectedUserId(null);
    setTraces([]);
    setAgentRuns([]);
    setAgentEvalReport(null);
    setCatalog(null);
    setCopilotLaunchKey(0);
    setView("dashboard");
  }

  async function handleCreateTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = canOpenTicketForOthers(user) ? form : { ...form, requesterEmail: user.email };
      if (!intakeAssessment) {
        const assessment = await runIntakeAssessment(payload);
        setError(
          assessment.shouldCreate
            ? "Analise pronta. Revise a classificacao da IA e clique em Criar chamado para confirmar."
            : assessment.blockedReason ?? assessment.summary
        );
        return;
      }

      const assessment = intakeAssessment;
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
      const payload = canOpenTicketForOthers(user) ? form : { ...form, requesterEmail: user.email };
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

  async function handleManagedUserSaved(updated: AppUser) {
    if (updated.id === user?.id) setUser(updated);
    setSelectedUserId(updated.id);
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
    <>
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
            priorityFilter={priorityFilter}
            setPriorityFilter={setPriorityFilter}
            slaRiskFilter={slaRiskFilter}
            setSlaRiskFilter={setSlaRiskFilter}
            confidenceFilter={confidenceFilter}
            setConfidenceFilter={setConfidenceFilter}
            onCreate={() => setView("new")}
            onCreateUser={() => setView("userCreate")}
            onRefresh={() => void refreshWorkspace()}
            isLoading={isLoading}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
            onOpenCopilot={() => setCopilotLaunchKey((current) => current + 1)}
          />
          {error ? (
            <div className="inline-alert" role="alert">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          ) : null}

          {view === "queue" ? (
            <TicketQueueView
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

          {view === "dashboard" ? (
            <DashboardView
              tickets={tickets}
              isLoading={isLoading}
              onStatusSelect={(status) => {
                resetQueueFilters(status);
                setView("queue");
              }}
              onOpenQueue={() => {
                resetQueueFilters();
                setView("queue");
              }}
              onOpenTicket={(ticket) => {
                setSelectedId(ticket.id);
                setView("detail");
              }}
            />
          ) : null}

          {view === "governance" ? (
            <GovernanceView
              tickets={tickets}
              traces={traces}
              agentRuns={agentRuns}
              evalReport={agentEvalReport}
              catalog={catalog}
              isLoading={isLoading}
              onOpenTicket={(ticket) => {
                setSelectedId(ticket.id);
                setView("detail");
              }}
            />
          ) : null}

          {view === "new" ? (
            <TicketIntakeView
              user={user}
              form={form.requesterEmail ? form : { ...form, requesterEmail: user.email }}
              setForm={updateForm}
              templates={catalog?.openingTemplates ?? []}
              groups={catalog?.groups ?? []}
              assessment={intakeAssessment}
              isAssessing={isAssessing}
              isSubmitting={isSubmitting}
              onAssess={() => void handleAssessIntake()}
              onSubmit={handleCreateTicket}
            />
          ) : null}

          {view === "detail" && selectedTicket ? (
            <TicketWorkspaceView
              user={user}
              ticket={selectedTicket}
              catalog={catalog}
              traces={traces}
              isSubmitting={isSubmitting}
              onAssign={(assigneeId) => mutateTicket(() => assignTicket(selectedTicket.id, assigneeId))}
              onStatus={(status) => mutateTicket(() => updateTicketStatus(selectedTicket.id, status))}
              onFollowup={(message, visibility) => mutateTicket(() => addFollowup(selectedTicket.id, message, visibility))}
              onTask={(title, description) => mutateTicket(() => addTask(selectedTicket.id, title, description))}
              onCompleteTask={(taskId) => mutateTicket(() => completeTask(selectedTicket.id, taskId))}
              onResolve={(message) => mutateTicket(() => resolveTicket(selectedTicket.id, message))}
              onApproval={(decision, note) => mutateTicket(() => decideTicketApproval(selectedTicket.id, decision, note))}
              onAiFeedback={(decision, rating, note) => mutateTicket(() => recordAiFeedback(selectedTicket.id, { decision, rating, note }))}
              onDelete={() => void handleDeleteTicket(selectedTicket)}
              onTicketUpdated={handleTicketUpdated}
              onChat={(message, onEvent) => handleTicketChatStream(selectedTicket, message, onEvent)}
            />
          ) : null}

          {view === "profile" ? <ProfileView user={user} onUpdated={(updated) => void handleCurrentUserUpdated(updated)} /> : null}

          {view === "users" ? (
            <UserDirectoryView
              user={user}
              catalog={catalog}
              onCreateUser={() => setView("userCreate")}
              onOpenUser={(item) => {
                setSelectedUserId(item.id);
                setView("userDetail");
              }}
            />
          ) : null}

          {view === "userCreate" ? (
            <UserCreatePage
              user={user}
              catalog={catalog}
              onCancel={() => setView("users")}
              onUserSaved={async (created) => {
                await handleManagedUserSaved(created);
                setView("userDetail");
              }}
            />
          ) : null}

          {view === "userDetail" ? (
            <UserDetailPage
              user={user}
              catalog={catalog}
              selectedUserId={selectedUserId}
              onBack={() => setView("users")}
              onUserSaved={async (updated) => {
                await handleManagedUserSaved(updated);
              }}
            />
          ) : null}
        </main>
      </div>
      {copilotLaunchKey > 0 ? (
        <Suspense fallback={<CopilotLoadingFallback />}>
          <CopilotWorkspace launchKey={copilotLaunchKey} runtimeUrl={copilotRuntimeUrl} />
        </Suspense>
      ) : null}
    </>
  );
}

