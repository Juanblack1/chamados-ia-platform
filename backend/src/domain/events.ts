import { EventEmitter } from "node:events";
import type { Ticket } from "./ticket.js";

export type DomainEvent =
  | { type: "ticket.created"; ticket: Ticket; occurredAt: string; traceId?: string }
  | { type: "ticket.triaged"; ticket: Ticket; occurredAt: string; traceId?: string }
  | { type: "agent.failed"; ticketId?: string; agent: string; reason: string; occurredAt: string; traceId?: string };

export class DomainEventBus {
  private readonly emitter = new EventEmitter();

  publish(event: DomainEvent): void {
    this.emitter.emit(event.type, event);
    this.emitter.emit("*", event);
  }

  onAny(listener: (event: DomainEvent) => void): void {
    this.emitter.on("*", listener);
  }
}
