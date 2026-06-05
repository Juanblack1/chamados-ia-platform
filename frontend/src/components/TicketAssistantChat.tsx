import { useEffect, useMemo, useState } from "react";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  useMessage,
  type AppendMessage,
  type ThreadMessageLike
} from "@assistant-ui/react";
import { Bot, Loader2, Send } from "lucide-react";
import type { Ticket, TicketAgentMemoryEntry, TicketChatStreamEvent } from "../lib/api";
import { localizeAgentContent } from "../lib/aiText";
import { Badge } from "./common";

type TicketAssistantChatProps = {
  ticket: Ticket;
  onTicketUpdated: (ticket: Ticket) => void;
  onChat: (message: string, onEvent: (event: TicketChatStreamEvent) => void) => Promise<void>;
};

export default function TicketAssistantChat({ ticket, onTicketUpdated, onChat }: TicketAssistantChatProps) {
  const specialistMemory = useMemo(
    () => (ticket.ai.agentMemory ?? []).filter((entry) => entry.agent === "ticket-specialist" && entry.role !== "system"),
    [ticket.ai.agentMemory]
  );
  const [liveMessages, setLiveMessages] = useState<TicketAgentMemoryEntry[]>(specialistMemory);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState("Pronto para conversar com o agente.");

  useEffect(() => {
    if (!isStreaming) setLiveMessages(specialistMemory);
  }, [isStreaming, specialistMemory]);

  const runtime = useExternalStoreRuntime<TicketAgentMemoryEntry>({
    messages: liveMessages,
    isRunning: isStreaming,
    isSendDisabled: isStreaming,
    convertMessage: convertSpecialistMemory,
    onNew: async (message: AppendMessage) => {
      const text = appendMessageToText(message);
      if (!text) return;
      const now = new Date().toISOString();
      const userMessage = buildTemporaryMemory(ticket, "user", "Voce", "current-user", text, now);
      const assistantMessage = buildTemporaryMemory(ticket, "assistant", "Agente especialista", "ticket-specialist", "", now);
      setLiveMessages([...specialistMemory, userMessage, assistantMessage]);
      setIsStreaming(true);
      setStreamStatus("Enviando mensagem e preparando contexto.");

      try {
        await onChat(text, (event) => {
          if (event.type === "status") {
            setStreamStatus(event.model ? `${event.message} Modelo: ${event.model}` : event.message);
            return;
          }

          if (event.type === "delta") {
            setStreamStatus(`Respondendo com ${event.model}.`);
            setLiveMessages((current) =>
              current.map((item) =>
                item.id === assistantMessage.id ? { ...item, content: `${item.content}${event.text}` } : item
              )
            );
            return;
          }

          if (event.type === "error") {
            setStreamStatus(event.message);
            setLiveMessages((current) =>
              current.map((item) =>
                item.id === assistantMessage.id && !item.content
                  ? { ...item, content: `Nao consegui concluir a resposta agora. ${event.message}` }
                  : item
              )
            );
            return;
          }

          const persistedMessages = event.messages.filter((entry) => entry.agent === "ticket-specialist" && entry.role !== "system");
          setLiveMessages(persistedMessages);
          onTicketUpdated(event.ticket);
          setStreamStatus("Resposta salva na memoria do chamado.");
        });
      } catch (cause) {
        const messageText = cause instanceof Error ? cause.message : "Falha ao conversar com o agente.";
        setStreamStatus(messageText);
        setLiveMessages((current) =>
          current.map((item) =>
            item.id === assistantMessage.id ? { ...item, content: `Erro no chat: ${messageText}` } : item
          )
        );
      } finally {
        setIsStreaming(false);
      }
    }
  });

  return (
    <section className="panel assistant-chat-panel" aria-labelledby="ticket-chat-title">
      <div className="panel-heading">
        <div>
          <h2 id="ticket-chat-title">Chat do chamado</h2>
          <p>Agente especialista Mastra com memoria do chamado, RAG e contexto da fila autorizada.</p>
        </div>
        <Badge tone="info">assistant-ui</Badge>
      </div>
      <div className="stream-status" aria-live="polite">
        {isStreaming ? <Loader2 className="spin" size={15} /> : <Bot size={15} />}
        <span>{streamStatus}</span>
      </div>
      <AssistantRuntimeProvider runtime={runtime}>
        <ThreadPrimitive.Root className="assistant-thread">
          <ThreadPrimitive.Viewport className="assistant-viewport">
            <ThreadPrimitive.Empty>
              <div className="assistant-empty">
                <Bot size={22} />
                <strong>Pergunte sobre diagnostico, SLA, proximos passos ou resposta ao solicitante.</strong>
                <span>O agente usa este chamado, os chamados acessiveis e a memoria ja registrada.</span>
              </div>
            </ThreadPrimitive.Empty>
            <ThreadPrimitive.Messages components={{ Message: AssistantThreadMessage }} />
            <ThreadPrimitive.ViewportFooter>
              <ComposerPrimitive.Root className="assistant-composer">
                <ComposerPrimitive.Input
                  className="assistant-input"
                  placeholder="Converse com o agente especialista deste chamado"
                  submitMode="ctrlEnter"
                  rows={2}
                />
                <ComposerPrimitive.Send className="primary-button small assistant-send">
                  {isStreaming ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                  <span>Enviar</span>
                </ComposerPrimitive.Send>
              </ComposerPrimitive.Root>
            </ThreadPrimitive.ViewportFooter>
          </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
      </AssistantRuntimeProvider>
    </section>
  );
}

function AssistantThreadMessage() {
  const role = useMessage((message) => message.role);
  return (
    <MessagePrimitive.Root className={`assistant-message ${role}`}>
      <div className="assistant-message-meta">{role === "assistant" ? "Agente especialista" : "Voce"}</div>
      <div className="assistant-message-bubble">
        <MessagePrimitive.Parts components={{ Text: AssistantMessageText }} />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessageText() {
  return (
    <p>
      <MessagePartPrimitive.Text />
    </p>
  );
}

function convertSpecialistMemory(message: TicketAgentMemoryEntry): ThreadMessageLike {
  return {
    id: message.id,
    role: message.role === "assistant" ? "assistant" : "user",
    content: [{ type: "text", text: message.role === "assistant" ? localizeAgentContent(message.content) : message.content }],
    createdAt: new Date(message.createdAt)
  };
}

function appendMessageToText(message: AppendMessage): string {
  return message.content
    .map((part) => ("text" in part ? part.text : ""))
    .join("\n")
    .trim();
}

function buildTemporaryMemory(
  ticket: Ticket,
  role: "user" | "assistant",
  actorName: string,
  actorId: string,
  content: string,
  createdAt: string
): TicketAgentMemoryEntry {
  return {
    id: `tmp-${role}-${createdAt}-${Math.random().toString(36).slice(2)}`,
    ticketId: ticket.id,
    agent: "ticket-specialist",
    role,
    actorId,
    actorName,
    content,
    createdAt,
    contextTicketIds: [ticket.id]
  };
}
