import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { Redis } from "@upstash/redis";
import type { AppEnv } from "../config/env.js";
import { hasRedisTicketStoreConfig } from "../domain/redisTicketRepository.js";

const scrypt = promisify(scryptCallback);

export type UserRole = "admin" | "supervisor" | "technician" | "requester";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  entityId: string;
  entityName: string;
  groupIds: string[];
  active: boolean;
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
    await Promise.all(users.map((user) => this.saveUser(user)));
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

  private userKey(id: string): string {
    return `${this.prefix}:auth:users:item:${id}`;
  }

  private sessionKey(token: string): string {
    return `${this.prefix}:auth:sessions:${hashSessionToken(token)}`;
  }
}

async function buildInitialUsers(env: AppEnv): Promise<StoredUser[]> {
  const adminPassword = env.AUTH_BOOTSTRAP_ADMIN_PASSWORD || (env.NODE_ENV === "production" ? "" : "admin123");
  const devPassword = env.NODE_ENV === "production" ? "" : "dev123";

  return Promise.all([
    withPassword(
      {
        id: "usr-admin",
        email: env.AUTH_BOOTSTRAP_ADMIN_EMAIL,
        name: "Administrador Service Desk",
        role: "admin",
        entityId: "corp",
        entityName: "Corporativo",
        groupIds: ["grp-erp", "grp-network", "grp-iam", "grp-platform"],
        active: true
      },
      adminPassword
    ),
    withPassword(
      {
        id: "usr-supervisor",
        email: "supervisor@empresa.local",
        name: "Carla Menezes",
        role: "supervisor",
        entityId: "corp",
        entityName: "Corporativo",
        groupIds: ["grp-erp", "grp-network", "grp-iam", "grp-platform"],
        active: true
      },
      devPassword
    ),
    withPassword(
      {
        id: "usr-tech-erp",
        email: "tecnico.erp@empresa.local",
        name: "Rafael Torres",
        role: "technician",
        entityId: "corp",
        entityName: "Corporativo",
        groupIds: ["grp-erp"],
        active: true
      },
      devPassword
    ),
    withPassword(
      {
        id: "usr-tech-network",
        email: "tecnico.rede@empresa.local",
        name: "Bianca Rocha",
        role: "technician",
        entityId: "corp",
        entityName: "Corporativo",
        groupIds: ["grp-network", "grp-iam"],
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
        active: true
      },
      devPassword
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
  return publicUser;
}
