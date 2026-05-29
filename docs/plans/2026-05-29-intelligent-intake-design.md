# Intelligent Intake Design

## Product Direction

The service desk should not create a ticket as the first reaction to vague text. Mature ITSM products use AI before ticket creation to classify intent, suggest fields, surface knowledge, route to a queue, and ask for missing context. This design brings that behavior into Service Desk IA with the existing stack: Node.js, TypeScript, Mastra, CopilotKit, Google via Vercel AI SDK, RAG, Qdrant, tracing, Docker, Kubernetes, Azure DevOps, and Vercel.

## External Patterns Used

- Zendesk Intelligent Triage: detect intent, sentiment, language, and entities from the first message.
- Freshservice Freddy: suggest ticket fields and knowledge content from the ticket context.
- Jira Service Management Virtual Service Agent: answer from knowledge first, then create a ticket when work remains.
- ServiceNow Now Assist for ITSM: summarize incidents, generate resolution notes, and create knowledge from incidents.
- GLPI: use ticket templates and category-driven forms so users provide the right fields for the request type.

## Implementation Shape

- Add a Mastra `intake-quality` agent to the agent registry.
- Add `AgentOrchestrator.assessIntake()` before `openTicket()`.
- Use RAG retrieval, triage, similar-ticket search, quality scoring, self-service deflection, and clarification questions.
- Block ticket creation when the request is too vague or self-service should answer it first.
- Add CopilotKit tool `assess_ticket_intake` and require it before `create_service_desk_ticket`.
- Add a frontend intake panel that shows quality score, missing information, suggested fields, RAG sources, and similar tickets.

## States

- `ready`: enough context to create the ticket.
- `needs_info`: missing details block ticket creation.
- `self_service`: knowledge base answer should be offered before opening a ticket.

## Verification

Automated checks must cover:

- Good intake creates a ticket and records `intake-quality` memory.
- Vague intake is blocked before persistence.
- CopilotKit exposes assessment as a tool call.
- Frontend build catches type drift in shared payloads.
