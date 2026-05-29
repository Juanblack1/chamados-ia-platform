import { randomUUID } from "node:crypto";

export type TraceKind = "workflow" | "rag" | "agent" | "llm" | "tool";
export type TraceStatus = "ok" | "error";

export type TraceSpanContext = {
  traceId: string;
  spanId: string;
};

export type TraceSpan = {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  kind: TraceKind;
  status: TraceStatus;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  inputSummary?: string;
  outputSummary?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

export class TraceRecorder {
  private readonly spans: TraceSpan[] = [];

  list(limit = 100): TraceSpan[] {
    return this.spans.slice(-limit).reverse();
  }

  async runSpan<T>(
    params: {
      traceId?: string;
      parentSpanId?: string;
      name: string;
      kind: TraceKind;
      inputSummary?: string;
      metadata?: Record<string, unknown>;
      summarizeOutput?: (output: T) => string;
    },
    operation: (context: TraceSpanContext) => Promise<T>
  ): Promise<T> {
    const traceId = params.traceId ?? randomUUID();
    const spanId = randomUUID();
    const start = performance.now();
    const startedAt = new Date().toISOString();

    try {
      const output = await operation({ traceId, spanId });
      this.record({
        id: spanId,
        traceId,
        parentSpanId: params.parentSpanId,
        name: params.name,
        kind: params.kind,
        status: "ok",
        startedAt,
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - start),
        inputSummary: truncate(params.inputSummary),
        outputSummary: truncate(params.summarizeOutput?.(output)),
        metadata: params.metadata
      });
      return output;
    } catch (cause) {
      this.record({
        id: spanId,
        traceId,
        parentSpanId: params.parentSpanId,
        name: params.name,
        kind: params.kind,
        status: "error",
        startedAt,
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - start),
        inputSummary: truncate(params.inputSummary),
        error: truncate(cause instanceof Error ? cause.message : "Unknown error"),
        metadata: params.metadata
      });
      throw cause;
    }
  }

  private record(span: TraceSpan): void {
    this.spans.push(span);
    if (this.spans.length > 500) this.spans.splice(0, this.spans.length - 500);
  }
}

function truncate(value: string | undefined, length = 420): string | undefined {
  if (!value) return undefined;
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}
