import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { Redis } from "@upstash/redis";
import type { AppEnv } from "../config/env.js";
import { hasRedisTicketStoreConfig } from "../domain/redisTicketRepository.js";

const scrypt = promisify(scryptCallback);

export const permissionKeys = ["tickets.open", "tickets.read", "tickets.work", "tickets.delete", "users.manage"] as const;

export type PermissionKey = (typeof permissionKeys)[number];
export type UserRole = "admin" | "manager" | "employee" | "requester";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  entityId: string;
  entityName: string;
  groupIds: string[];
  permissions: PermissionKey[];
  active: boolean;
};

export type CreateUserInput = {
  email: string;
  name: string;
  role: UserRole;
  entityId?: string;
  entityName?: string;
  groupIds?: string[];
  permissions?: PermissionKey[];
  active?: boolean;
  password: string;
};

export type UpdateUserInput = Partial<Omit<CreateUserInput, "password">> & {
  password?: string;
};

type StoredUser = AppUser & {
  passwordHash?: string;
};

type StoredSession = {
  userId: string;
  expiresAt: string;
};

export interface AuthStore {
  readonly kind: "memory" | "redis";
  initialize(): Promise<void>;
  listUsers(): Promise<AppUser[]>;
  findUserById(id: string): Promise<AppUser | undefined>;
  verifyCredentials(email: string, password: string): Promise<AppUser | undefined>;
  createUser(input: CreateUserInput): Promise<AppUser>;
  updateUser(id: string, input: UpdateUserInput): Promise<AppUser | undefined>;
  createSession(userId: string): Promise<{ token: string; expiresAt: string }>;
  findSessionUser(token: string): Promise<AppUser | undefined>;
  revokeSession(token: string): Promise<void>;
}

export async function createAuthStore(env: AppEnv): Promise<AuthStore> {
  if (env.NODE_ENV === "production" && !env.AUTH_BOOTSTRAP_ADMIN_PASSWORD) {
    throw new Error("AUTH_BOOTSTRAP_ADMIN_PASSWORD is required in production.");
  }

  const store = hasRedisTicketStoreConfig(env)
    ? RedisAuthStore.fromEnv(env)
    : new MemoryAuthStore(env);
  await store.initialize();
  return store;
}

export class MemoryAuthStore implements AuthStore {
  readonly kind = "memory";
  private readonly users = new Map<string, StoredUser>();
  private readonly sessions = new Map<string, StoredSession>();

  constructor(private readonly env: AppEnv) {}

  async initialize(): Promise<void> {
    const users = await buildInitialUsers(this.env);
    users.forEach((user) => this.users.set(user.id, user));
  }

  async listUsers(): Promise<AppUser[]> {
    return [...this.users.values()].map(toPublicUser);
  }

  async findUserById(id: string): Promise<AppUser | undefined> {
    const user = this.users.get(id);
    return user?.active ? toPublicUser(user) : undefined;
  }

  async verifyCredentials(email: string, password: string): Promise<AppUser | undefined> {
    const user = [...this.users.values()].find((candidate) => candidate.email.toLowerCase() === email.toLowerCase());
    if (!user?.active || !user.passwordHash) return undefined;
    return (await verifyPassword(password, user.passwordHash)) ? toPublicUser(user) : undefined;
  }

  async createUser(input: CreateUserInput): Promise<AppUser> {
    this.ensureEmailAvailable(input.email);
    const user = await withPassword(buildUser(input), input.password);
    this.users.set(user.id, user);
    return toPublicUser(user);
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<AppUser | undefined> {
    const current = this.users.get(id);
    if (!current) return undefined;
    if (input.email) this.ensureEmailAvailable(input.email, id);

    const nextPublic: AppUser = normalizeUpdatedUser(current, input);
    const next: StoredUser = {
      ...nextPublic,
      passwordHash: input.password ? await hashPassword(input.password) : current.passwordHash
    };
    this.users.set(id, next);
    return toPublicUser(next);
  }

  async createSession(userId: string): Promise<{ token: string; expiresAt: string }> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + this.env.AUTH_SESSION_TTL_SECONDS * 1000).toISOString();
    this.sessions.set(hashSessionToken(token), { userId, expiresAt });
    return { token, expiresAt };
  }

  async findSessionUser(token: string): Promise<AppUser | undefined> {
    const key = hashSessionToken(token);
    const session = this.sessions.get(key);
    if (!session) return undefined;
    if (Date.parse(session.expiresAt) <= Date.now()) {
      this.sessions.delete(key);
      return undefined;
    }
    return this.findUserById(session.userId);
  }

  async revokeSession(token: string): Promise<void> {
    this.sessions.delete(hashSessionToken(token));
  }

  private ensureEmailAvailable(email: string, exceptId?: string): void {
    const conflict = [...this.users.values()].find(
      (candidate) => candidate.id !== exceptId && candidate.email.toLowerCase() === email.toLowerCase()
    );
    if (conflict) throw new Error("email_already_exists");
  }
}

export class RedisAuthStore implements AuthStore {
  readonly kind = "redis";
  private readonly userIndexKey: string;

  private constructor(
    private readonly redis: Redis,
    private readonly env: AppEnv,
    private readonly prefix: string
  ) {
    this.userIndexKey = `${prefix}:auth:users:index`;
  }

  static fromEnv(env: AppEnv): RedisAuthStore {
    const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
    const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
    return new RedisAuthStore(new Redis({ url, token }), env, env.TICKET_REDIS_PREFIX);
  }

  async initialize(): Promise<void> {
    const users = await buildInitialUsers(this.env);
    await Promise.all(
      users.map(async (user) => {
        const existing = await this.redis.get<StoredUser>(this.userKey(user.id));
        if (!existing || this.env.NODE_ENV === "production") await this.saveUser(user);
      })
    );
  }

  async listUsers(): Promise<AppUser[]> {
    const ids = await this.redis.smembers<string[]>(this.userIndexKey);
    const users = await Promise.all(ids.map((id) => this.redis.get<StoredUser>(this.userKey(id))));
    return users.filter((user): user is StoredUser => Boolean(user?.active)).map(toPublicUser);
  }

  async findUserById(id: string): Promise<AppUser | undefined> {
    const user = await this.redis.get<StoredUser>(this.userKey(id));
    return user?.active ? toPublicUser(user) : undefined;
  }

  async verifyCredentials(email: string, password: string): Promise<AppUser | undefined> {
    const users = await this.listStoredUsers();
    const user = users.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase());
    if (!user?.active || !user.passwordHash) return undefined;
    return (await verifyPassword(password, user.passwordHash)) ? toPublicUser(user) : undefined;
  }

  async createUser(input: CreateUserInput): Promise<AppUser> {
    await this.ensureEmailAvailable(input.email);
    const user = await withPassword(buildUser(input), input.password);
    await this.saveUser(user);
    return toPublicUser(user);
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<AppUser | undefined> {
    const current = await this.redis.get<StoredUser>(this.userKey(id));
    if (!current) return undefined;
    if (input.email) await this.ensureEmailAvailable(input.email, id);

    const nextPublic = normalizeUpdatedUser(current, input);
    const next: StoredUser = {
      ...nextPublic,
      passwordHash: input.password ? await hashPassword(input.password) : current.passwordHash
    };
    await this.saveUser(next);
    return toPublicUser(next);
  }

  async createSession(userId: string): Promise<{ token: string; expiresAt: string }> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + this.env.AUTH_SESSION_TTL_SECONDS * 1000).toISOString();
    await this.redis.set(this.sessionKey(token), { userId, expiresAt }, { ex: this.env.AUTH_SESSION_TTL_SECONDS });
    return { token, expiresAt };
  }

  async findSessionUser(token: string): Promise<AppUser | undefined> {
    const session = await this.redis.get<StoredSession>(this.sessionKey(token));
    if (!session) return undefined;
    if (Date.parse(session.expiresAt) <= Date.now()) {
      await this.revokeSession(token);
      return undefined;
    }
    return this.findUserById(session.userId);
  }

  async revokeSession(token: string): Promise<void> {
    await this.redis.del(this.sessionKey(token));
  }

  private async listStoredUsers(): Promise<StoredUser[]> {
    const ids = await this.redis.smembers<string[]>(this.userIndexKey);
    const users = await Promise.all(ids.map((id) => this.redis.get<StoredUser>(this.userKey(id))));
    return users.filter((user): user is StoredUser => Boolean(user));
  }

  private async saveUser(user: StoredUser): Promise<void> {
    await Promise.all([this.redis.sadd(this.userIndexKey, user.id), this.redis.set(this.userKey(user.id), user)]);
  }

  private async ensureEmailAvailable(email: string, exceptId?: string): Promise<void> {
    const conflict = (await this.listStoredUsers()).find(
      (candidate) => candidate.id !== exceptId && candidate.email.toLowerCase() === email.toLowerCase()
    );
    if (conflict) throw new Error("email_already_exists");
  }

  private userKey(id: string): string {
    return `${this.prefix}:auth:users:item:${id}`;
  }

  private sessionKey(token: string): string {
    return `${this.prefix}:auth:sessions:${hashSessionToken(token)}`;
  }
}

function buildUser(input: CreateUserInput): AppUser {
  const role = normalizeRole(input.role);
  return {
    id: randomUUID(),
    email: input.email.toLowerCase(),
    name: input.name.trim(),
    role,
    entityId: input.entityId?.trim() || "corp",
    entityName: input.entityName?.trim() || "Corporativo",
    groupIds: normalizeGroupIds(role, input.groupIds ?? []),
    permissions: normalizePermissions(role, input.permissions),
    active: input.active ?? true
  };
}

function normalizeUpdatedUser(current: StoredUser, input: UpdateUserInput): AppUser {
  const role = normalizeRole(input.role ?? current.role);
  return {
    id: current.id,
    email: input.email?.toLowerCase() ?? current.email,
    name: input.name?.trim() || current.name,
    role,
    entityId: input.entityId?.trim() || current.entityId,
    entityName: input.entityName?.trim() || current.entityName,
    groupIds: normalizeGroupIds(role, input.groupIds ?? current.groupIds),
    permissions: normalizePermissions(role, input.permissions ?? current.permissions),
    active: input.active ?? current.active
  };
}

function normalizeGroupIds(role: UserRole, groupIds: string[]): string[] {
  if (role === "requester") return [];
  return [...new Set(groupIds.map((groupId) => groupId.trim()).filter(Boolean))];
}

export function hasPermission(user: AppUser, permission: PermissionKey): boolean {
  return normalizePermissions(normalizeRole(user.role), user.permissions).includes(permission);
}

function normalizeRole(role: UserRole | string): UserRole {
  if (role === "supervisor") return "manager";
  if (role === "technician") return "employee";
  if (role === "admin" || role === "manager" || role === "employee" || role === "requester") return role;
  return "requester";
}

function normalizePermissions(role: UserRole, permissions?: string[]): PermissionKey[] {
  if (role === "admin") return [...permissionKeys];
  const allowed = new Set(permissionKeys);
  const defaultPermissions = defaultPermissionsForRole(role);
  const requested = permissions?.filter((permission): permission is PermissionKey => allowed.has(permission as PermissionKey));
  return [...new Set(requested?.length ? requested : defaultPermissions)];
}

function defaultPermissionsForRole(role: UserRole): PermissionKey[] {
  if (role === "manager") return ["tickets.open", "tickets.read", "tickets.work"];
  if (role === "employee") return ["tickets.open", "tickets.read", "tickets.work"];
  return ["tickets.open", "tickets.read"];
}

async function buildInitialUsers(env: AppEnv): Promise<StoredUser[]> {
  const adminPassword = env.AUTH_BOOTSTRAP_ADMIN_PASSWORD || (env.NODE_ENV === "production" ? "" : "admin123");
  const devPassword = env.NODE_ENV === "production" ? "" : "dev123";
  const testRequesterPassword = env.AUTH_TEST_REQUESTER_PASSWORD || (env.NODE_ENV === "production" ? "" : devPassword);
  const adminUser = withPassword(
    {
      id: "usr-admin",
      email: env.AUTH_BOOTSTRAP_ADMIN_EMAIL,
      name: "Administrador Service Desk",
      role: "admin",
      entityId: "corp",
      entityName: "Corporativo",
      groupIds: ["grp-erp", "grp-network", "grp-iam", "grp-platform", "grp-workplace", "grp-approvals"],
      permissions: [...permissionKeys],
      active: true
    },
    adminPassword
  );

  if (env.NODE_ENV === "production") {
    return [await adminUser];
  }

  return Promise.all([
    adminUser,
    withPassword(
      {
        id: "usr-supervisor",
        email: "supervisor@empresa.local",
        name: "Carla Menezes",
        role: "manager",
        entityId: "corp",
        entityName: "Corporativo",
        groupIds: ["grp-erp", "grp-network", "grp-iam", "grp-platform", "grp-workplace", "grp-approvals"],
        permissions: defaultPermissionsForRole("manager"),
        active: true
      },
      devPassword
    ),
    withPassword(
      {
        id: "usr-tech-erp",
        email: "tecnico.erp@empresa.local",
        name: "Rafael Torres",
        role: "employee",
        entityId: "corp",
        entityName: "Corporativo",
        groupIds: ["grp-erp"],
        permissions: defaultPermissionsForRole("employee"),
        active: true
      },
      devPassword
    ),
    withPassword(
      {
        id: "usr-tech-network",
        email: "tecnico.rede@empresa.local",
        name: "Bianca Rocha",
        role: "employee",
        entityId: "corp",
        entityName: "Corporativo",
        groupIds: ["grp-network", "grp-iam"],
        permissions: defaultPermissionsForRole("employee"),
        active: true
      },
      devPassword
    ),
    withPassword(
      {
        id: "usr-requester",
        email: "solicitante@empresa.local",
        name: "Ana Silva",
        role: "requester",
        entityId: "corp",
        entityName: "Corporativo",
        groupIds: [],
        permissions: defaultPermissionsForRole("requester"),
        active: true
      },
      devPassword
    ),
    withPassword(
      {
        id: "usr-requester-test",
        email: env.AUTH_TEST_REQUESTER_EMAIL,
        name: "Solicitante Teste",
        role: "requester",
        entityId: "corp",
        entityName: "Corporativo",
        groupIds: [],
        permissions: defaultPermissionsForRole("requester"),
        active: true
      },
      testRequesterPassword
    )
  ]);
}

async function withPassword(user: AppUser, password: string): Promise<StoredUser> {
  return password ? { ...user, passwordHash: await hashPassword(password) } : user;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${key.toString("base64url")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, encoded] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !encoded) return false;
  const expected = Buffer.from(encoded, "base64url");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

function toPublicUser(user: StoredUser): AppUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  const role = normalizeRole(publicUser.role);
  return {
    ...publicUser,
    role,
    groupIds: normalizeGroupIds(role, publicUser.groupIds ?? []),
    permissions: normalizePermissions(role, publicUser.permissions)
  };
}
