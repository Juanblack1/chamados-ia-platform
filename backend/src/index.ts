import { loadEnv } from "./config/env.js";
import { buildServer } from "./http/server.js";

const env = loadEnv();
const app = await buildServer(env);

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
