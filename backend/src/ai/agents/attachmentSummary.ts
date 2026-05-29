import type { CreateTicketInput } from "../../domain/ticket.js";

export function summarizeTicketInputForLlm(input: CreateTicketInput): CreateTicketInput {
  return {
    ...input,
    attachments: input.attachments.map(summarizeAttachment)
  };
}

function summarizeAttachment(value: string, index: number): string {
  if (!value.startsWith("data:image/")) return value;

  const mimeEnd = value.indexOf(";");
  const mimeType = mimeEnd > 5 ? value.slice(5, mimeEnd) : "image";
  return `${mimeType} attachment ${index + 1} attached by requester; binary data omitted from prompt.`;
}
