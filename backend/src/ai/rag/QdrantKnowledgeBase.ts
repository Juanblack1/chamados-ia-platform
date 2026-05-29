import { QdrantClient } from "@qdrant/js-client-rest";
import type { AppEnv } from "../../config/env.js";
import type { RagSource } from "../../domain/ticket.js";
import type { ModelGateway } from "../modelGateway.js";
import { knowledgeSeed, type KnowledgeDocument } from "./knowledgeSeed.js";

export class QdrantKnowledgeBase {
  private readonly client: QdrantClient;
  private ready = false;

  constructor(
    private readonly env: AppEnv,
    private readonly llm: ModelGateway
  ) {
    this.client = new QdrantClient({
      url: env.QDRANT_URL,
      apiKey: env.QDRANT_API_KEY || undefined,
      checkCompatibility: false
    } as ConstructorParameters<typeof QdrantClient>[0] & { checkCompatibility: false });
  }

  async ensureReady(): Promise<void> {
    if (this.ready) return;

    try {
      const client = this.client as unknown as {
        getCollections: () => Promise<{ collections: { name: string }[] }>;
        createCollection: (name: string, config: unknown) => Promise<unknown>;
        upsert: (name: string, payload: unknown) => Promise<unknown>;
      };
      const collections = await client.getCollections();
      const exists = collections.collections.some((collection) => collection.name === this.env.QDRANT_COLLECTION);

      if (!exists) {
        await client.createCollection(this.env.QDRANT_COLLECTION, {
          vectors: {
            size: this.env.EMBEDDING_DIMENSION,
            distance: "Cosine"
          }
        });
      }

      const vectors = await this.llm.embed(knowledgeSeed.map((doc) => doc.text));
      await client.upsert(this.env.QDRANT_COLLECTION, {
        points: knowledgeSeed.map((doc, index) => ({
          id: index + 1,
          vector: vectors[index],
          payload: doc
        }))
      });
    } catch {
      // Local demo can run without Qdrant; search falls back to in-memory scoring.
    } finally {
      this.ready = true;
    }
  }

  async search(query: string, limit = 4): Promise<RagSource[]> {
    await this.ensureReady();

    try {
      const [vector] = await this.llm.embed([query]);
      const client = this.client as unknown as {
        search: (name: string, payload: unknown) => Promise<Array<{ payload?: KnowledgeDocument; score?: number }>>;
      };
      const result = await client.search(this.env.QDRANT_COLLECTION, {
        vector,
        limit,
        with_payload: true
      });

      return result
        .filter((point) => point.payload)
        .map((point) => ({
          id: point.payload!.id,
          title: point.payload!.title,
          source: point.payload!.source,
          excerpt: point.payload!.excerpt,
          relevance: Number((point.score ?? point.payload!.relevance).toFixed(2))
        }));
    } catch {
      return localSearch(query, limit);
    }
  }
}

function localSearch(query: string, limit: number): RagSource[] {
  const terms = new Set(query.toLowerCase().split(/\W+/).filter((term) => term.length > 2));

  return knowledgeSeed
    .map((doc) => {
      const haystack = `${doc.title} ${doc.text}`.toLowerCase();
      const score = [...terms].reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return {
        id: doc.id,
        title: doc.title,
        source: doc.source,
        excerpt: doc.excerpt,
        relevance: Number(Math.max(doc.relevance, score / Math.max(terms.size, 1)).toFixed(2))
      };
    })
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
}
