import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, KeyRound, LifeBuoy, Loader2, Save, ShieldCheck, UserPlus, X } from "lucide-react";
import { createUser, updateUser, type AppUser, type CreateUserPayload, type PermissionKey, type ServiceDeskCatalog } from "../../lib/api";
import { defaultPermissionsForRole, roleLabel, roleOptions } from "../../lib/presentation";
import { Badge, Field } from "../../components/common";
import { GroupCheckboxes as AdminGroupCheckboxes, PermissionCheckboxes as AdminPermissionCheckboxes } from "./AccessControls";

export function UserSummaryStrip({
  item,
  groups
}: {
  item: AppUser;
  groups: ServiceDeskCatalog["groups"];
}) {
  const groupNames = groups.filter((group) => item.groupIds.includes(group.id)).map((group) => group.name);
  const permissions = item.permissions ?? defaultPermissionsForRole(item.role);

  return (
    <section className="user-summary-strip" aria-label="Resumo do usuario">
      <article>
        <span>Status</span>
        <strong>{item.active ? "Ativo" : "Inativo"}</strong>
      </article>
      <article>
        <span>Cargo</span>
        <strong>{roleLabel(item.role)}</strong>
      </article>
      <article>
        <span>Entidade</span>
        <strong>{item.entityName}</strong>
      </article>
      <article>
        <span>Grupos</span>
        <strong>{groupNames.length ? groupNames.join(", ") : item.role === "requester" ? "Portal" : "Sem grupo"}</strong>
      </article>
      <article>
        <span>Permissoes</span>
        <strong>{permissions.length}</strong>
      </article>
    </section>
  );
}

export function UserSecurityPanel({ item, mode }: { item?: AppUser; mode: "create" | "detail" }) {
  const permissions = item?.permissions ?? (item ? defaultPermissionsForRole(item.role) : []);
  const criticalPermissions = permissions.filter((permission) => permission === "tickets.delete" || permission === "users.manage");

  return (
    <aside className="panel user-security-panel" aria-labelledby="user-security-title">
      <div className="panel-heading">
        <div>
          <h2 id="user-security-title">Resumo de seguranca</h2>
          <p>{mode === "create" ? "Regras aplicadas quando a conta for criada." : "Regras efetivas para este usuario."}</p>
        </div>
        <Badge tone="info">RBAC</Badge>
      </div>
      <div className="security-scope-list">
        <div>
          <KeyRound size={16} />
          <span>Login por e-mail e senha com sessao HttpOnly.</span>
        </div>
        <div>
          <ShieldCheck size={16} />
          <span>Cargo define o escopo base de leitura e tratamento de chamados.</span>
        </div>
        <div>
          <LifeBuoy size={16} />
          <span>Grupos limitam quais filas tecnicas o usuario pode operar.</span>
        </div>
      </div>
      {item ? (
        <div className="security-effective-list">
          <strong>Regras atuais</strong>
          <span>{roleLabel(item.role)} em {item.entityName}</span>
          <span>{item.groupIds.length} grupos vinculados</span>
          <span>{permissions.length} permissoes ativas</span>
        </div>
      ) : null}
      <div className={criticalPermissions.length ? "security-warning active" : "security-warning"}>
        <AlertTriangle size={16} />
        <span>Excluir chamados e gerenciar usuarios devem ficar restritos a administradores.</span>
      </div>
    </aside>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const strength = passwordStrength(password);

  return (
    <div className={`password-strength ${strength.tone}`} aria-live="polite">
      <div><span style={{ width: `${strength.score}%` }} /></div>
      <strong>{strength.label}</strong>
      <small>{strength.hint}</small>
    </div>
  );
}

function passwordStrength(password: string): { score: number; label: string; hint: string; tone: "weak" | "medium" | "strong" } {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ];
  const passed = checks.filter(Boolean).length;
  if (!password) return { score: 8, label: "Senha inicial", hint: "Minimo 8 caracteres.", tone: "weak" };
  if (passed >= 4 && password.length >= 10) return { score: 100, label: "Senha forte", hint: "Boa para criar ou redefinir acesso.", tone: "strong" };
  if (passed >= 3) return { score: 64, label: "Senha media", hint: "Inclua maiusculas, numeros ou simbolos para fortalecer.", tone: "medium" };
  return { score: 32, label: "Senha fraca", hint: "Use pelo menos 8 caracteres com letras e numeros.", tone: "weak" };
}

export function CreateUserForm({
  catalog,
  onUserSaved,
  onCancel,
  variant = "embedded"
}: {
  catalog: ServiceDeskCatalog | null;
  onUserSaved: (user: AppUser) => void | Promise<void>;
  onCancel?: () => void;
  variant?: "embedded" | "page";
}) {
  const [form, setForm] = useState<CreateUserPayload>({
    email: "",
    name: "",
    role: "employee",
    entityId: "corp",
    entityName: "Corporativo",
    groupIds: [],
    permissions: defaultPermissionsForRole("employee"),
    active: true,
    password: ""
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      if (form.password !== confirmPassword) {
        setMessage("As senhas precisam ser iguais.");
        return;
      }
      const response = await createUser(form);
      await onUserSaved(response.user);
      setForm({ ...form, email: "", name: "", password: "", groupIds: [], permissions: defaultPermissionsForRole(form.role) });
      setConfirmPassword("");
      setMessage("Usuario criado.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Nao foi possivel criar o usuario.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className={variant === "page" ? "panel user-create-form user-page-form" : "user-create-form"} onSubmit={submit}>
      <div className="admin-form-heading">
        <UserPlus size={17} />
        <strong>Criar usuario com e-mail e senha</strong>
      </div>
      {message ? <span className="form-note" role="status">{message}</span> : null}
      <div className="admin-form-grid">
        <Field label="Nome">
          <input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </Field>
        <Field label="E-mail">
          <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </Field>
        <Field label="Perfil">
          <select
            value={form.role}
            onChange={(event) => {
              const nextRole = event.target.value as AppUser["role"];
              setForm({
                ...form,
                role: nextRole,
                groupIds: nextRole === "requester" ? [] : form.groupIds,
                permissions: defaultPermissionsForRole(nextRole)
              });
            }}
          >
            {roleOptions().map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
          </select>
        </Field>
        <Field label="Entidade">
          <input required minLength={2} value={form.entityName} onChange={(event) => setForm({ ...form, entityName: event.target.value })} />
        </Field>
        <Field label="Senha inicial">
          <input
            required
            type="password"
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <PasswordStrength password={form.password} />
        </Field>
        <Field label="Confirmar senha">
          <input
            required
            type="password"
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </Field>
      </div>
      <AdminPermissionCheckboxes
        role={form.role}
        selected={form.permissions ?? []}
        onChange={(permissions) => setForm({ ...form, permissions })}
      />
      <AdminGroupCheckboxes
        groups={catalog?.groups ?? []}
        selected={form.groupIds ?? []}
        disabled={form.role === "requester"}
        onChange={(groupIds) => setForm({ ...form, groupIds })}
      />
      <div className="sticky-actions user-form-actions">
        {onCancel ? (
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isSaving}>
            <X size={18} />
            <span>Cancelar</span>
          </button>
        ) : null}
        <button type="submit" className={variant === "page" ? "primary-button" : "primary-button small"} disabled={isSaving}>
          {isSaving ? <Loader2 className="spin" size={18} /> : <UserPlus size={18} />}
          <span>{isSaving ? "Criando usuario" : "Criar usuario"}</span>
        </button>
      </div>
    </form>
  );
}

export function UserDetailPanel({
  item,
  catalog,
  onUserSaved,
  onCancel
}: {
  item: AppUser;
  catalog: ServiceDeskCatalog | null;
  onUserSaved: (user: AppUser) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [email, setEmail] = useState(item.email);
  const [role, setRole] = useState(item.role);
  const [entityName, setEntityName] = useState(item.entityName);
  const [active, setActive] = useState(item.active);
  const [groupIds, setGroupIds] = useState(item.groupIds);
  const [permissions, setPermissions] = useState<PermissionKey[]>(item.permissions ?? defaultPermissionsForRole(item.role));
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setName(item.name);
    setEmail(item.email);
    setRole(item.role);
    setEntityName(item.entityName);
    setActive(item.active);
    setGroupIds(item.groupIds);
    setPermissions(item.permissions ?? defaultPermissionsForRole(item.role));
    setPassword("");
    setMessage(null);
  }, [item]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await updateUser(item.id, {
        name,
        email,
        role,
        entityName,
        active,
        groupIds,
        permissions,
        password: password.trim() ? password : undefined
      });
      setPassword("");
      await onUserSaved(response.user);
      setMessage("Usuario salvo.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Nao foi possivel salvar o usuario.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="panel user-detail-panel" onSubmit={save}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{item.email}</p>
          <h2>{item.name}</h2>
          <p>Edite cargo, grupos e permissoes operacionais.</p>
        </div>
        <Badge tone={active ? "success" : "neutral"}>{active ? "Ativo" : "Inativo"}</Badge>
      </div>
      {message ? <div className="inline-alert compact" role="status">{message}</div> : null}
      <div className="admin-form-grid detail-fields">
        <Field label="Nome">
          <input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="E-mail">
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Cargo">
          <select
            value={role}
            onChange={(event) => {
              const nextRole = event.target.value as AppUser["role"];
              setRole(nextRole);
              setGroupIds(nextRole === "requester" ? [] : groupIds);
              setPermissions(defaultPermissionsForRole(nextRole));
            }}
          >
            {roleOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="Entidade">
          <input required minLength={2} value={entityName} onChange={(event) => setEntityName(event.target.value)} />
        </Field>
        <Field label="Nova senha">
          <input
            type="password"
            minLength={8}
            autoComplete="new-password"
            placeholder="Manter senha atual"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordStrength password={password} />
        </Field>
        <label className="switch-row user-active-switch">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          <span>Usuario ativo</span>
        </label>
      </div>
      <AdminPermissionCheckboxes role={role} selected={permissions} onChange={setPermissions} />
      <AdminGroupCheckboxes
        groups={catalog?.groups ?? []}
        selected={groupIds}
        disabled={role === "requester"}
        onChange={setGroupIds}
      />
      <div className="sticky-actions">
        {onCancel ? (
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isSaving}>
            <X size={18} />
            <span>Cancelar alteracoes</span>
          </button>
        ) : null}
        <button type="submit" className="primary-button" disabled={isSaving}>
          {isSaving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
          <span>{isSaving ? "Salvando usuario" : "Salvar usuario"}</span>
        </button>
      </div>
    </form>
  );
}

