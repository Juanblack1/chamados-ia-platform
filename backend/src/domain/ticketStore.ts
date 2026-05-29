import type { AppEnv } from "../config/env.js";
import { hasRedisTicketStoreConfig, RedisTicketRepository } from "./redisTicketRepository.js";
import { TicketRepository, type TicketStore } from "./ticketRepository.js";

export async function createTicketStore(env: AppEnv): Promise<TicketStore> {
  const hasRedisConfig = hasRedisTicketStoreConfig(env);

  if (env.TICKET_STORAGE === "redis" && !hasRedisConfig) {
    throw new Error("TICKET_STORAGE=redis requires KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN.");
  }

  if (env.TICKET_STORAGE === "redis" || (env.TICKET_STORAGE === "auto" && hasRedisConfig)) {
    const repository = RedisTicketRepository.fromEnv(env);
    await repository.initialize();
    return repository;
  }

  return new TicketRepository();
}
