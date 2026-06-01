import type { AppUser, PermissionKey, ServiceDeskCatalog } from "../../lib/api";
import { permissionOptions } from "../../lib/presentation";

export function GroupCheckboxes({
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

export function PermissionCheckboxes({
  role,
  selected,
  onChange
}: {
  role: AppUser["role"];
  selected: PermissionKey[];
  onChange: (permissions: PermissionKey[]) => void;
}) {
  const isAdmin = role === "admin";
  const effectiveSelected = isAdmin ? permissionOptions().map((permission) => permission.value) : selected;

  return (
    <fieldset className="permission-checkboxes" disabled={isAdmin}>
      <legend>Permissoes</legend>
      {permissionOptions().map((permission) => (
        <label key={permission.value}>
          <input
            type="checkbox"
            checked={effectiveSelected.includes(permission.value)}
            onChange={(event) => {
              const next = event.target.checked
                ? [...selected, permission.value]
                : selected.filter((item) => item !== permission.value);
              onChange(next);
            }}
          />
          <span>
            <strong>{permission.label}</strong>
            <small>{permission.description}</small>
          </span>
        </label>
      ))}
      {isAdmin ? <p>Administradores sempre mantem todas as permissoes.</p> : null}
    </fieldset>
  );
}
