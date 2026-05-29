import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CopilotKit } from "@copilotkit/react-core/v2";
import App from "./App";
import "./styles.css";

const runtimeUrl =
  import.meta.env.VITE_COPILOT_RUNTIME_URL ?? (import.meta.env.PROD ? "/api/copilotkit" : "http://localhost:4000/api/copilotkit");
const apiKey = import.meta.env.VITE_API_KEY ?? "local-dev-key";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CopilotKit runtimeUrl={runtimeUrl} headers={{ "x-api-key": apiKey }} showDevConsole={false}>
      <App />
    </CopilotKit>
  </StrictMode>
);
