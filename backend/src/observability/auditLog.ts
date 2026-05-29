import { randomUUID } from "node:crypto";
import type { DomainEvent } from "../domain/events.js";

export type AuditEntry = {
  id: string;
  eventType: DomainEvent["type"];
  message: string;
  occurredAt: string;
  payload: DomainEvent;
};

export class AuditLog {
  private readonly entries: AuditEntry[] = [];

  record(event: DomainEvent): AuditEntry {
    const entry: AuditEntry = {
      id: `AUD-${randomUUID().slice(0, 8).toUpperCase()}`,
      eventType: event.type,
      message: this.messageFor(event),
      occurredAt: event.occurredAt,
      payload: event
    };

    this.entries.unshift(entry);
    return entry;
  }

  list(limit = 50): AuditEntry[] {
    return this.entries.slice(0, limit);
  }

  private messageFor(event: DomainEvent): string {
    if (event.type === "ticket.created") return `Ticket ${event.ticket.number} created`;
    if (event.type === "ticket.triaged") return `Ticket ${event.ticket.number} triaged by agents`;
    return `${event.agent} failed: ${event.reason}`;
  }
}
