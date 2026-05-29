import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv } from "../backend/src/config/env.js";
import { buildServer } from "../backend/src/http/server.js";

let serverPromise: ReturnType<typeof buildServer> | undefined;

function preserveOriginalApiPath(request: IncomingMessage) {
  if (!request.url) return;

  const url = new URL(request.url, `https://${request.headers.host ?? "localhost"}`);
  const rewrittenPath = url.searchParams.get("path");
  if (!rewrittenPath) return;

  url.pathname = `/api/${rewrittenPath}`;
  url.searchParams.delete("path");
  request.url = `${url.pathname}${url.search}`;
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  preserveOriginalApiPath(request);
  const server = await (serverPromise ??= buildServer(loadEnv()));
  await server.ready();
  server.server.emit("request", request, response);
}
