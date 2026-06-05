// Suite: Mastra registry contract
// Invariant: the Mastra registry exposes the service desk agents, tools, workflows, and scorers that Studio must debug.
// Boundary IN: code-defined Mastra registry and registered primitive metadata.
// Boundary OUT: Mastra HTTP server and browser Studio rendering, covered by local API checks.
import { describe, expect, it } from "vitest";
import { mastra } from "../src/ai/mastra/index.js";

describe("Mastra registry", () => {
  it("exposes service desk primitives to Studio", () => {
    expect(Object.keys(mastra.listAgents())).toEqual(
      expect.arrayContaining([
        "intake-quality",
        "ticket-triage",
        "rag-retrieval",
        "routing",
        "resolution-drafter",
        "sla-risk",
        "ticket-memory",
        "ticket-specialist"
      ])
    );
    expect(Object.keys(mastra.listTools() ?? {})).toEqual(
      expect.arrayContaining(["describeAiServiceDesk", "searchServiceDeskKnowledge", "queryServiceDeskDatabase"])
    );
    expect(Object.keys(mastra.listWorkflows())).toEqual(expect.arrayContaining(["openServiceDeskTicketWorkflow"]));
    expect(Object.keys(mastra.listScorers() ?? {})).toEqual(
      expect.arrayContaining(["intakeOutcome", "ticketOutcome", "ragGrounding", "workflowTrajectory"])
    );
  });

  it("scores RAG grounding with positive and negative evidence", async () => {
    const scorer = mastra.getScorer("ragGrounding");

    await expect(
      scorer.run({
        input: { expectedSourceIds: ["kb-access-reset"] },
        output: { sourceIds: ["kb-access-reset", "kb-priority-sla"] }
      })
    ).resolves.toEqual(expect.objectContaining({ score: 1, reason: "rag-grounded" }));

    await expect(
      scorer.run({
        input: { expectedSourceIds: ["kb-access-reset"] },
        output: { sourceIds: ["kb-priority-sla"] }
      })
    ).resolves.toEqual(expect.objectContaining({ score: 0, reason: "missing-source:kb-access-reset" }));
  });
});
