import type { RagSource } from "../../domain/ticket.js";

export type KnowledgeDocument = RagSource & {
  text: string;
};

export const knowledgeSeed: KnowledgeDocument[] = [
  {
    id: "kb-erp-billing-lock",
    title: "ERP billing batch failure runbook",
    source: "Confluence / ERP / Billing",
    excerpt: "When billing batch jobs fail, validate tax service connectivity and replay pending invoices after locking the fiscal period.",
    text: "ERP billing failures usually involve tax service connectivity, pending invoice locks, or fiscal period state. Check the tax-service health endpoint, replay failed jobs with idempotency keys, and escalate to Finance Systems when fiscal close is blocked.",
    relevance: 0.98
  },
  {
    id: "kb-vpn-instability",
    title: "VPN instability and packet loss checklist",
    source: "Network runbook",
    excerpt: "VPN disconnect loops are commonly caused by expired device posture checks or unstable ISP packet loss.",
    text: "For VPN disconnect loops, collect client version, device posture status, packet loss, and region. Reset posture token, move the user to the backup gateway, and escalate only when packet loss remains above two percent.",
    relevance: 0.92
  },
  {
    id: "kb-access-reset",
    title: "Identity access reset policy",
    source: "IAM policy",
    excerpt: "Password and MFA resets require requester identity validation before any privileged action.",
    text: "Access reset tickets require requester validation, manager approval for privileged apps, and audit logging. Never reveal temporary credentials in ticket comments. Use the identity workflow and mark the ticket waiting_customer when validation is missing.",
    relevance: 0.89
  },
  {
    id: "kb-priority-sla",
    title: "Priority and SLA classification",
    source: "Service desk policy",
    excerpt: "Critical priority is reserved for revenue, security, or company-wide availability impact.",
    text: "Critical priority applies to revenue-blocking, security, compliance, or company-wide availability incidents. High priority applies to department-level impact. Medium is single-team degradation. Low is individual request with workaround.",
    relevance: 0.95
  }
];
