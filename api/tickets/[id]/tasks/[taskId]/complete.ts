import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv } from "../../../../../backend/src/config/env.js";
import { buildServer } from "../../../../../backend/src/http/server.js";

let serverPromise: ReturnType<typeof buildServer> | undefined;

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  const server = await (serverPromise ??= buildServer(loadEnv()));
  await server.ready();
  server.server.emit("request", request, response);
}
