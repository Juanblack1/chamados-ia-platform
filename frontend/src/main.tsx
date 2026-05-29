import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CopilotKit, CopilotPopup } from "@copilotkit/react-core/v2";
import App from "./App";
import "./styles.css";

const runtimeUrl =
  import.meta.env.VITE_COPILOT_RUNTIME_URL ?? (import.meta.env.PROD ? "/api/copilotkit" : "http://localhost:4000/api/copilotkit");
const configuredApiKey = import.meta.env.VITE_API_KEY as string | undefined;
const apiHeaders: Record<string, string> = configuredApiKey ? { "x-api-key": configuredApiKey } : {};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CopilotKit runtimeUrl={runtimeUrl} headers={apiHeaders} credentials="include" showDevConsole={false}>
      <App />
      <CopilotPopup
        defaultOpen={false}
        width={420}
        height={620}
        labels={{
          modalHeaderTitle: "Copiloto de chamados",
          welcomeMessageText: "Posso listar chamados, prever triagem ou criar um chamado com rastreio.",
          chatInputPlaceholder: "Pergunte sobre SLA, fila ou abertura de chamado..."
        }}
        attachments={{ enabled: true, accept: "image/*", maxSize: 2 * 1024 * 1024 }}
      />
    </CopilotKit>
  </StrictMode>
);
