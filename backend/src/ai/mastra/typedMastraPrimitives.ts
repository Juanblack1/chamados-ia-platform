import { createScorer, type MastraScorer } from "@mastra/core/evals";
import type { RequestContext } from "@mastra/core/request-context";
import { createTool, type ToolAction } from "@mastra/core/tools";
import { createStep, createWorkflow, type AnyWorkflow, type Step } from "@mastra/core/workflows";
import type { z } from "zod";

export type ServiceDeskTool = ToolAction<any, any, any, any, any, any, unknown>;
export type ServiceDeskScorer = MastraScorer<string, unknown, unknown, Record<string, unknown>>;
export type ServiceDeskStep = Step<string, unknown, unknown, unknown, unknown, unknown>;

export type ServiceDeskToolContext<TRequestContext = unknown> = {
  requestContext?: RequestContext<TRequestContext>;
};

type ServiceDeskToolConfig<TRequestContext = unknown> = {
  id: string;
  description: string;
  inputSchema?: z.ZodType;
  outputSchema?: z.ZodType;
  requestContextSchema?: z.ZodType;
  mcp?: {
    annotations?: {
      title?: string;
      readOnlyHint?: boolean;
      destructiveHint?: boolean;
      idempotentHint?: boolean;
      openWorldHint?: boolean;
    };
  };
  execute: (input: unknown, context: ServiceDeskToolContext<TRequestContext>) => Promise<unknown> | unknown;
};

type ServiceDeskScorerRun = {
  input?: unknown;
  output: unknown;
};

type ServiceDeskScorerBuilder = {
  generateScore(
    step: (context: { run: ServiceDeskScorerRun }) => number | Promise<number>
  ): {
    generateReason(
      step: (context: { run: ServiceDeskScorerRun; score: number }) => string | Promise<string>
    ): ServiceDeskScorer;
  };
};

type ServiceDeskScorerConfig = {
  id: string;
  name?: string;
  description: string;
  type: {
    input: z.ZodType;
    output: z.ZodType;
  };
};

type ServiceDeskStepConfig = {
  id: string;
  description?: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  execute: (context: { inputData: unknown }) => Promise<unknown> | unknown;
};

type ServiceDeskWorkflowConfig = {
  id: string;
  description?: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
};

const createServiceDeskTool = createTool as unknown as <TRequestContext = unknown>(config: ServiceDeskToolConfig<TRequestContext>) => ServiceDeskTool;
const createServiceDeskScorer = createScorer as unknown as (config: ServiceDeskScorerConfig) => ServiceDeskScorerBuilder;
const createServiceDeskStep = createStep as unknown as (config: ServiceDeskStepConfig) => ServiceDeskStep;
const createServiceDeskWorkflow = createWorkflow as unknown as (config: ServiceDeskWorkflowConfig) => AnyWorkflow;

export function defineServiceDeskTool<TRequestContext = unknown>(config: ServiceDeskToolConfig<TRequestContext>): ServiceDeskTool {
  return createServiceDeskTool(config);
}

export function defineServiceDeskScorer(config: ServiceDeskScorerConfig): ServiceDeskScorerBuilder {
  return createServiceDeskScorer(config);
}

export function defineServiceDeskStep(config: ServiceDeskStepConfig): ServiceDeskStep {
  return createServiceDeskStep(config);
}

export function defineServiceDeskWorkflow(config: ServiceDeskWorkflowConfig): AnyWorkflow {
  return createServiceDeskWorkflow(config);
}
