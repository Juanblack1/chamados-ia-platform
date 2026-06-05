import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  KeyRound,
  LifeBuoy,
  ListFilter,
  Loader2,
  Save,
  Search,
  ShieldCheck,
  UserPlus,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import {
  updateProfile,
  type AppUser,
  type ServiceDeskCatalog
} from "../../lib/api";
import {
  canManageUsers,
  defaultPermissionsForRole,
  roleLabel,
  roleOptions
} from "../../lib/presentation";
import { Badge, Field } from "../../components/common";
import { CreateUserForm, UserDetailPanel, UserSecurityPanel, UserSummaryStrip } from "./UserForms";
export function ProfileView({ user, onUpdated }: { user: AppUser; onUpdated: (user: AppUser) => void }) {
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

export function UserDirectoryView({
  user,
  catalog,
  onCreateUser,
  onOpenUser
}: {
  user: AppUser;
  catalog: ServiceDeskCatalog | null;
  onCreateUser: () => void;
  onOpenUser: (user: AppUser) => void;
}) {
  const users = catalog?.users ?? [];
  const groups = catalog?.groups ?? [];
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppUser["role"] | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const visibleUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter((item) => {
      const groupNames = groups
        .filter((group) => item.groupIds.includes(group.id))
        .map((group) => group.name)
        .join(" ")
        .toLowerCase();
      const matchesQuery = normalizedQuery
        ? `${item.name} ${item.email} ${item.entityName} ${groupNames}`.toLowerCase().includes(normalizedQuery)
        : true;
      const matchesRole = roleFilter === "all" || item.role === roleFilter;
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? item.active : !item.active);
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [groups, query, roleFilter, statusFilter, users]);
  const userMetrics = useMemo(() => {
    const active = users.filter((item) => item.active).length;
    const admins = users.filter((item) => item.role === "admin").length;
    const technicians = users.filter((item) => item.role === "employee" || item.role === "manager").length;
    const withoutGroups = users.filter((item) => item.role !== "requester" && item.groupIds.length === 0).length;
    return [
      { label: "Ativos", value: active.toString(), icon: UserRound },
      { label: "Administradores", value: admins.toString(), icon: ShieldCheck },
      { label: "Atendimento", value: technicians.toString(), icon: LifeBuoy },
      { label: "Sem grupo", value: withoutGroups.toString(), icon: AlertTriangle }
    ];
  }, [users]);

  if (!canManageUsers(user)) {
    return (
      <div className="panel empty-state">
        <ShieldCheck size={28} />
        <h3>Acesso restrito</h3>
        <p>Somente usuarios com permissao de administracao podem ver e editar contas.</p>
      </div>
    );
  }

  return (
    <section className="users-admin-page" aria-label="Administracao de usuarios">
      <section className="panel users-admin-hero">
        <div>
          <p className="eyebrow">Acesso, perfis e credenciais</p>
          <h2>Usuarios</h2>
          <p>Consulte contas, cargos, grupos e permissoes. Cadastro e edicao ficam em telas separadas.</p>
        </div>
        <div className="users-admin-metrics" aria-label="Metricas de usuarios">
          {userMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article key={metric.label}>
                <Icon size={16} />
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </article>
            );
          })}
        </div>
      </section>

      <div className="users-directory-grid">
        <section className="panel users-directory-panel" aria-labelledby="users-directory-title">
          <div className="panel-heading">
            <div>
              <h2 id="users-directory-title">Diretorio</h2>
              <p>Clique em qualquer linha para abrir o detalhe do usuario.</p>
            </div>
            <button type="button" className="primary-button small" onClick={onCreateUser}>
              <UserPlus size={16} />
              <span>Novo usuario</span>
            </button>
          </div>
          <div className="users-toolbar">
            <label className="search-box">
              <Search size={17} />
              <span className="sr-only">Buscar usuarios</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, e-mail, entidade ou grupo" />
            </label>
            <label className="select-filter">
              <ListFilter size={16} />
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as AppUser["role"] | "all")}>
                <option value="all">Todos perfis</option>
                {roleOptions().map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
            </label>
            <label className="select-filter">
              <ShieldCheck size={16} />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}>
                <option value="all">Todos status</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>
            </label>
          </div>
          <div className="users-table" role="table" aria-label="Usuarios cadastrados">
            <div className="users-table-head" role="row">
              <span role="columnheader">Usuario</span>
              <span role="columnheader">Perfil</span>
              <span role="columnheader">Grupos</span>
              <span role="columnheader">Permissoes</span>
              <span role="columnheader">Status</span>
            </div>
            {visibleUsers.map((item) => {
              const groupNames = groups.filter((group) => item.groupIds.includes(group.id)).map((group) => group.name);
              const permissions = item.permissions ?? defaultPermissionsForRole(item.role);
              return (
                <button
                  key={item.id}
                  type="button"
                  className="users-table-row"
                  onClick={() => onOpenUser(item)}
                >
                  <span className="users-identity" data-label="Usuario">
                    <strong>{item.name}</strong>
                    <small>{item.email}</small>
                    <small>{item.entityName}</small>
                  </span>
                  <span data-label="Perfil"><Badge tone={item.role === "admin" ? "info" : "neutral"}>{roleLabel(item.role)}</Badge></span>
                  <span data-label="Grupos">{groupNames.length ? groupNames.join(", ") : item.role === "requester" ? "Portal" : "Sem grupo"}</span>
                  <span data-label="Permissoes">{permissions.length} permissoes</span>
                  <span data-label="Status"><Badge tone={item.active ? "success" : "neutral"}>{item.active ? "Ativo" : "Inativo"}</Badge></span>
                </button>
              );
            })}
            {visibleUsers.length === 0 ? (
              <div className="users-empty-row">
                <UsersRound size={22} />
                <span>Nenhum usuario encontrado com os filtros atuais.</span>
                <button type="button" className="secondary-button small" onClick={() => {
                  setQuery("");
                  setRoleFilter("all");
                  setStatusFilter("all");
                }}>
                  <X size={16} />
                  <span>Limpar filtros</span>
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="users-admin-editor">
          <section className="panel users-governance-panel" aria-labelledby="governance-title">
            <div className="panel-heading">
              <div>
                <h2 id="governance-title">Governanca</h2>
                <p>Regras operacionais aplicadas ao acesso.</p>
              </div>
              <Badge tone="info">RBAC</Badge>
            </div>
            <div className="governance-list">
              <div>
                <KeyRound size={16} />
                <span>Login por e-mail e senha com sessao HttpOnly.</span>
              </div>
              <div>
                <ShieldCheck size={16} />
                <span>Permissoes controlam abertura, leitura, tratamento, exclusao e usuarios.</span>
              </div>
              <div>
                <LifeBuoy size={16} />
                <span>Grupos definem quais filas tecnicas o usuario pode operar.</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

export function UserCreatePage({
  user,
  catalog,
  onCancel,
  onUserSaved
}: {
  user: AppUser;
  catalog: ServiceDeskCatalog | null;
  onCancel: () => void;
  onUserSaved: (user: AppUser) => void | Promise<void>;
}) {
  if (!canManageUsers(user)) {
    return (
      <div className="panel empty-state">
        <ShieldCheck size={28} />
        <h3>Acesso restrito</h3>
        <p>Somente usuarios com permissao de administracao podem criar contas.</p>
      </div>
    );
  }

  return (
    <section className="user-form-page" aria-label="Cadastrar usuario">
      <section className="panel user-page-header">
        <button type="button" className="secondary-button small" onClick={onCancel}>
          <ChevronLeft size={16} />
          <span>Voltar para usuarios</span>
        </button>
        <div>
          <p className="eyebrow">Nova conta</p>
          <h2>Cadastrar usuario</h2>
          <p>Crie uma conta com e-mail, senha, cargo, grupos e permissoes.</p>
        </div>
      </section>
      <div className="user-form-layout">
        <CreateUserForm catalog={catalog} onUserSaved={onUserSaved} onCancel={onCancel} variant="page" />
        <UserSecurityPanel mode="create" />
      </div>
    </section>
  );
}

export function UserDetailPage({
  user,
  catalog,
  selectedUserId,
  onBack,
  onUserSaved
}: {
  user: AppUser;
  catalog: ServiceDeskCatalog | null;
  selectedUserId: string | null;
  onBack: () => void;
  onUserSaved: (user: AppUser) => void | Promise<void>;
}) {
  const selectedUser = (catalog?.users ?? []).find((item) => item.id === selectedUserId);

  if (!canManageUsers(user)) {
    return (
      <div className="panel empty-state">
        <ShieldCheck size={28} />
        <h3>Acesso restrito</h3>
        <p>Somente usuarios com permissao de administracao podem editar contas.</p>
      </div>
    );
  }

  if (!selectedUser) {
    return (
      <div className="panel empty-state">
        <UsersRound size={28} />
        <h3>Usuario nao encontrado</h3>
        <p>Volte para o diretorio e selecione uma conta ativa.</p>
        <button type="button" className="secondary-button" onClick={onBack}>
          <ChevronLeft size={18} />
          <span>Voltar para usuarios</span>
        </button>
      </div>
    );
  }

  return (
    <section className="user-form-page" aria-label="Editar usuario">
      <section className="panel user-page-header">
        <button type="button" className="secondary-button small" onClick={onBack}>
          <ChevronLeft size={16} />
          <span>Voltar para usuarios</span>
        </button>
        <div>
          <p className="eyebrow">{selectedUser.email}</p>
          <h2>{selectedUser.name}</h2>
          <p>{selectedUser.entityName} - {roleLabel(selectedUser.role)}</p>
        </div>
      </section>
      <UserSummaryStrip item={selectedUser} groups={catalog?.groups ?? []} />
      <div className="user-form-layout">
        <UserDetailPanel item={selectedUser} catalog={catalog} onUserSaved={onUserSaved} onCancel={onBack} />
        <UserSecurityPanel item={selectedUser} mode="detail" />
      </div>
    </section>
  );
}


