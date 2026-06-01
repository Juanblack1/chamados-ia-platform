import type { AppUser } from "../security/authStore.js";
import { hasPermission } from "../security/authStore.js";
import type { Ticket } from "./ticket.js";

export function canAccessTicket(ticket: Ticket, user: AppUser): boolean {
  if (!hasPermission(user, "tickets.read")) return false;
  if (user.role === "admin") return true;
  if (user.role === "manager") {
    const sameEntity = ticket.entityId === user.entityId;
    const sameGroup = Boolean(ticket.assignedGroupId && user.groupIds.includes(ticket.assignedGroupId));
    return sameEntity && (sameGroup || ticket.requesterEmail.toLowerCase() === user.email.toLowerCase());
  }
  if (ticket.requesterEmail.toLowerCase() === user.email.toLowerCase()) return true;
  if (user.role === "employee") {
    return Boolean(ticket.assigneeId === user.id || (ticket.assignedGroupId && user.groupIds.includes(ticket.assignedGroupId)));
  }
  return false;
}

export function canWorkTicket(ticket: Ticket, user: AppUser): boolean {
  if (!hasPermission(user, "tickets.work")) return false;
  if (user.role === "admin") return true;
  return (user.role === "manager" || user.role === "employee") && canAccessTicket(ticket, user);
}
