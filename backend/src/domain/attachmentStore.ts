import { createHash, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import type { AppEnv } from "../config/env.js";
import { hasRedisTicketStoreConfig } from "./redisTicketRepository.js";

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const DataUrlPattern = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/i;

type StoredAttachment = {
  id: string;
  ticketId?: string;
  createdBy: string;
  createdAt: string;
  contentType: SupportedImageType;
  byteLength: number;
  sha256: string;
  fileName: string;
  contentBase64: string;
  scan: AttachmentScanResult;
};

type SupportedImageType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

export type AttachmentObject = Omit<StoredAttachment, "contentBase64"> & {
  content: Buffer;
};

export type PreparedTicketAttachments = {
  attachments: string[];
  pendingIds: string[];
};

export type AttachmentScanResult = {
  status: "clean" | "blocked";
  findings: string[];
  scannedAt: string;
};

export interface TicketAttachmentStore {
  readonly kind: "memory" | "redis";
  savePending(input: {
    createdBy: string;
    contentType: SupportedImageType;
    content: Buffer;
    fileName: string;
    scan: AttachmentScanResult;
  }): Promise<StoredAttachment>;
  attachToTicket(id: string, ticketId: string): Promise<StoredAttachment | undefined>;
  get(ticketId: string, id: string): Promise<AttachmentObject | undefined>;
  deletePending(ids: string[]): Promise<void>;
}

export class AttachmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttachmentValidationError";
  }
}

export function createTicketAttachmentStore(env: AppEnv): TicketAttachmentStore {
  if (hasRedisTicketStoreConfig(env)) return RedisTicketAttachmentStore.fromEnv(env);
  return new MemoryTicketAttachmentStore();
}

export async function prepareTicketAttachments(
  store: TicketAttachmentStore,
  attachments: string[],
  createdBy: string
): Promise<PreparedTicketAttachments> {
  const prepared: string[] = [];
  const pendingIds: string[] = [];

  for (const attachment of attachments) {
    if (!attachment.startsWith("data:image/")) {
      prepared.push(attachment);
      continue;
    }

    const parsed = parseImageDataUrl(attachment);
    const scan = scanImageAttachment(parsed.content, parsed.contentType);
    if (scan.status === "blocked") {
      throw new AttachmentValidationError(`Anexo bloqueado pela validacao de seguranca: ${scan.findings.join("; ")}.`);
    }

    const stored = await store.savePending({
      createdBy,
      contentType: parsed.contentType,
      content: parsed.content,
      fileName: `evidencia-${pendingIds.length + 1}.${extensionFor(parsed.contentType)}`,
      scan
    });
    pendingIds.push(stored.id);
    prepared.push(buildPendingAttachmentReference(stored));
  }

  return { attachments: prepared, pendingIds };
}

export async function finalizeTicketAttachments(
  store: TicketAttachmentStore,
  ticketId: string,
  prepared: PreparedTicketAttachments
): Promise<string[]> {
  const finalized = new Map<string, string>();

  for (const id of prepared.pendingIds) {
    const stored = await store.attachToTicket(id, ticketId);
    if (stored) finalized.set(buildPendingAttachmentReference(stored), buildAttachmentUrl(ticketId, stored.id));
  }

  return prepared.attachments.map((attachment) => finalized.get(attachment) ?? attachment);
}

export function buildAttachmentUrl(ticketId: string, attachmentId: string): string {
  return `/api/tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(attachmentId)}`;
}

export class MemoryTicketAttachmentStore implements TicketAttachmentStore {
  readonly kind = "memory";
  private readonly objects = new Map<string, StoredAttachment>();

  async savePending(input: Parameters<TicketAttachmentStore["savePending"]>[0]): Promise<StoredAttachment> {
    const stored = buildStoredAttachment(input);
    this.objects.set(stored.id, stored);
    return stored;
  }

  async attachToTicket(id: string, ticketId: string): Promise<StoredAttachment | undefined> {
    const current = this.objects.get(id);
    if (!current) return undefined;
    const next = { ...current, ticketId };
    this.objects.set(id, next);
    return next;
  }

  async get(ticketId: string, id: string): Promise<AttachmentObject | undefined> {
    const stored = this.objects.get(id);
    if (!stored || stored.ticketId !== ticketId) return undefined;
    return toAttachmentObject(stored);
  }

  async deletePending(ids: string[]): Promise<void> {
    ids.forEach((id) => {
      const current = this.objects.get(id);
      if (!current?.ticketId) this.objects.delete(id);
    });
  }
}

class RedisTicketAttachmentStore implements TicketAttachmentStore {
  readonly kind = "redis";

  private constructor(
    private readonly redis: Redis,
    private readonly prefix: string
  ) {}

  static fromEnv(env: AppEnv): RedisTicketAttachmentStore {
    const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
    const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
    return new RedisTicketAttachmentStore(new Redis({ url, token }), env.TICKET_REDIS_PREFIX);
  }

  async savePending(input: Parameters<TicketAttachmentStore["savePending"]>[0]): Promise<StoredAttachment> {
    const stored = buildStoredAttachment(input);
    await this.redis.set(this.key(stored.id), stored, { ex: 60 * 60 * 24 * 30 });
    return stored;
  }

  async attachToTicket(id: string, ticketId: string): Promise<StoredAttachment | undefined> {
    const current = await this.redis.get<StoredAttachment>(this.key(id));
    if (!current) return undefined;
    const next = { ...current, ticketId };
    await this.redis.set(this.key(id), next, { ex: 60 * 60 * 24 * 180 });
    return next;
  }

  async get(ticketId: string, id: string): Promise<AttachmentObject | undefined> {
    const stored = await this.redis.get<StoredAttachment>(this.key(id));
    if (!stored || stored.ticketId !== ticketId) return undefined;
    return toAttachmentObject(stored);
  }

  async deletePending(ids: string[]): Promise<void> {
    const pending = await Promise.all(ids.map((id) => this.redis.get<StoredAttachment>(this.key(id))));
    const keys = pending
      .map((stored, index) => (!stored?.ticketId ? this.key(ids[index]) : undefined))
      .filter((key): key is string => Boolean(key));
    if (keys.length > 0) await this.redis.del(...keys);
  }

  private key(id: string): string {
    return `${this.prefix}:attachments:item:${id}`;
  }
}

function parseImageDataUrl(value: string): { contentType: SupportedImageType; content: Buffer } {
  const match = DataUrlPattern.exec(value);
  if (!match) throw new AttachmentValidationError("Anexo invalido. Envie PNG, JPG, WebP ou GIF em base64.");

  const contentType = normalizeImageType(match[1]);
  const content = Buffer.from(match[2], "base64");
  if (content.byteLength === 0) throw new AttachmentValidationError("Anexo vazio.");
  if (content.byteLength > MAX_ATTACHMENT_BYTES) throw new AttachmentValidationError("Anexo acima do limite de 2 MB.");

  return { contentType, content };
}

function scanImageAttachment(content: Buffer, contentType: SupportedImageType): AttachmentScanResult {
  const findings: string[] = [];

  if (!matchesImageSignature(content, contentType)) {
    findings.push("assinatura binaria nao corresponde ao tipo informado");
  }

  const firstBytes = content.subarray(0, Math.min(content.length, 8192)).toString("utf8").toLowerCase();
  if (/\bmz\b|<script|<svg|javascript:|<\?php|powershell|wscript\.shell/.test(firstBytes)) {
    findings.push("conteudo ativo ou executavel detectado");
  }

  if (content.subarray(0, 2).equals(Buffer.from("MZ")) || content.subarray(0, 4).equals(Buffer.from("PK\u0003\u0004"))) {
    findings.push("assinatura de executavel ou arquivo compactado detectada");
  }

  return {
    status: findings.length ? "blocked" : "clean",
    findings,
    scannedAt: new Date().toISOString()
  };
}

function buildStoredAttachment(input: Parameters<TicketAttachmentStore["savePending"]>[0]): StoredAttachment {
  const sha256 = createHash("sha256").update(input.content).digest("hex");
  return {
    id: randomUUID(),
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
    contentType: input.contentType,
    byteLength: input.content.byteLength,
    sha256,
    fileName: input.fileName,
    contentBase64: input.content.toString("base64"),
    scan: input.scan
  };
}

function toAttachmentObject(stored: StoredAttachment): AttachmentObject {
  const { contentBase64, ...metadata } = stored;
  return {
    ...metadata,
    content: Buffer.from(contentBase64, "base64")
  };
}

function buildPendingAttachmentReference(stored: Pick<StoredAttachment, "id" | "contentType" | "byteLength" | "sha256">): string {
  return `attachment://pending/${stored.id};type=${stored.contentType};bytes=${stored.byteLength};sha256=${stored.sha256}`;
}

function normalizeImageType(value: string): SupportedImageType {
  const lower = value.toLowerCase();
  if (lower === "image/jpg") return "image/jpeg";
  if (lower === "image/png" || lower === "image/jpeg" || lower === "image/webp" || lower === "image/gif") return lower;
  throw new AttachmentValidationError("Tipo de anexo nao permitido.");
}

function matchesImageSignature(content: Buffer, contentType: SupportedImageType): boolean {
  if (contentType === "image/png") return content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === "image/jpeg") return content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
  if (contentType === "image/gif") return content.subarray(0, 6).toString("ascii") === "GIF87a" || content.subarray(0, 6).toString("ascii") === "GIF89a";
  return content.subarray(0, 4).toString("ascii") === "RIFF" && content.subarray(8, 12).toString("ascii") === "WEBP";
}

function extensionFor(contentType: SupportedImageType): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";
  return "gif";
}
