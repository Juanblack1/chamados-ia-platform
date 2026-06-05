import {
  AlertTriangle,
  Bot,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  ListFilter,
  Loader2,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  TicketCheck,
  UserPlus,
  UserRound,
  UsersRound
} from "lucide-react";
import type { AppUser, TicketPriority, TicketStatus } from "../lib/api";
import { canManageUsers, hasPermission, roleLabel, type View } from "../lib/presentation";

export type ThemePreference = "system" | "light" | "dark";
export type SlaRiskFilter = "all" | "breached" | "warning" | "ok";
export type AiConfidenceFilter = "all" | "low" | "normal";

export function Sidebar({
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
    { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    ...(requester ? [] : [{ id: "governance" as const, label: "Governanca IA", icon: ShieldCheck }]),
    { id: "queue" as const, label: requester ? "Meus chamados" : "Minha fila", icon: ClipboardList },
    { id: "new" as const, label: "Abrir chamado", icon: Plus },
    ...(requester ? [] : [{ id: "detail" as const, label: "Workspace", icon: TicketCheck }]),
    ...(canManageUsers(user) ? [{ id: "users" as const, label: "Usuarios", icon: UsersRound }] : [])
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
          const isActive = item.id === "users" ? ["users", "userCreate", "userDetail"].includes(active) : active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={isActive ? "nav-item active" : "nav-item"}
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

export function Topbar({
  view,
  user,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  slaRiskFilter,
  setSlaRiskFilter,
  confidenceFilter,
  setConfidenceFilter,
  onCreate,
  onCreateUser,
  onRefresh,
  isLoading,
  isSidebarCollapsed,
  onToggleSidebar,
  themeMode,
  setThemeMode,
  onOpenCopilot
}: {
  view: View;
  user: AppUser;
  search: string;
  setSearch: (value: string) => void;
  statusFilter: TicketStatus | "all";
  setStatusFilter: (value: TicketStatus | "all") => void;
  priorityFilter: TicketPriority | "all";
  setPriorityFilter: (value: TicketPriority | "all") => void;
  slaRiskFilter: SlaRiskFilter;
  setSlaRiskFilter: (value: SlaRiskFilter) => void;
  confidenceFilter: AiConfidenceFilter;
  setConfidenceFilter: (value: AiConfidenceFilter) => void;
  onCreate: () => void;
  onCreateUser: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  themeMode: ThemePreference;
  setThemeMode: (value: ThemePreference) => void;
  onOpenCopilot: () => void;
}) {
  const title =
    view === "new"
      ? "Abrir chamado"
      : view === "detail"
        ? "Workspace do chamado"
        : view === "dashboard"
          ? "Dashboard"
          : view === "governance"
            ? "Governanca IA"
            : view === "users"
              ? "Usuarios"
              : view === "userCreate"
                ? "Cadastrar usuario"
                : view === "userDetail"
                  ? "Editar usuario"
                  : view === "profile"
                    ? "Perfil"
                    : user.role === "requester"
                      ? "Meus chamados"
                      : "Minha fila";
  const isUserArea = view === "users" || view === "userCreate" || view === "userDetail";

  return (
    <header className="topbar">
      {isSidebarCollapsed ? (
        <button type="button" className="icon-button mobile-menu-button" onClick={onToggleSidebar} aria-label="Abrir menu">
          <Menu size={18} />
        </button>
      ) : null}
      <div>
        <p className="eyebrow">{roleLabel(user.role)} - {user.entityName}</p>
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        <div className="theme-segmented" role="group" aria-label="Tema">
          {[
            { value: "system" as const, label: "Sistema", icon: Monitor },
            { value: "light" as const, label: "Claro", icon: Sun },
            { value: "dark" as const, label: "Escuro", icon: Moon }
          ].map((option) => {
            const Icon = option.icon;
            return (
              <button
                type="button"
                key={option.value}
                className={themeMode === option.value ? "active" : ""}
                onClick={() => setThemeMode(option.value)}
                aria-pressed={themeMode === option.value}
              >
                <Icon size={15} />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
        {view === "queue" ? (
          <>
            <label className="search-box">
              <Search size={17} />
              <span className="sr-only">Buscar chamados</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar numero, servico ou solicitante" />
            </label>
            <label className="select-filter">
              <ListFilter size={16} />
              <span className="sr-only">Filtrar status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TicketStatus | "all")}>
                <option value="all">Todos os status</option>
                <option value="new">Novo</option>
                <option value="open">Aberto</option>
                <option value="triaging">Triagem</option>
                <option value="in_progress">Em atendimento</option>
                <option value="waiting_customer">Aguardando solicitante</option>
                <option value="pending_approval">Aguardando aprovacao</option>
                <option value="escalated">Escalado</option>
                <option value="resolved">Resolvido</option>
                <option value="closed">Fechado</option>
              </select>
            </label>
            <label className="select-filter">
              <AlertTriangle size={16} />
              <span className="sr-only">Filtrar prioridade</span>
              <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as TicketPriority | "all")}>
                <option value="all">Todas prioridades</option>
                <option value="critical">Critica</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baixa</option>
              </select>
            </label>
            <label className="select-filter">
              <Clock3 size={16} />
              <span className="sr-only">Filtrar SLA</span>
              <select value={slaRiskFilter} onChange={(event) => setSlaRiskFilter(event.target.value as SlaRiskFilter)}>
                <option value="all">Todo SLA</option>
                <option value="breached">SLA vencido</option>
                <option value="warning">Perto do vencimento</option>
                <option value="ok">SLA em dia</option>
              </select>
            </label>
            <label className="select-filter">
              <Bot size={16} />
              <span className="sr-only">Filtrar confianca IA</span>
              <select value={confidenceFilter} onChange={(event) => setConfidenceFilter(event.target.value as AiConfidenceFilter)}>
                <option value="all">Toda confianca IA</option>
                <option value="low">Baixa confianca</option>
                <option value="normal">Confianca normal</option>
              </select>
            </label>
          </>
        ) : null}
        <button type="button" className="icon-button" onClick={onOpenCopilot} aria-label="Abrir copiloto de chamados" title="Abrir copiloto de chamados">
          <Bot size={18} />
        </button>
        <button type="button" className="icon-button" onClick={onRefresh} aria-label="Atualizar dados">
          {isLoading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
        </button>
        {isUserArea && canManageUsers(user) ? (
          <button type="button" className="primary-button" onClick={onCreateUser}>
            <UserPlus size={18} />
            <span>Novo usuario</span>
          </button>
        ) : null}
        {!isUserArea && view !== "profile" && hasPermission(user, "tickets.open") ? (
          <button type="button" className="primary-button" onClick={onCreate}>
            <Plus size={18} />
            <span>Abrir chamado</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}
