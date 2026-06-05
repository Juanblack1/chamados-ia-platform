import { CopilotKit, CopilotPopup } from "@copilotkit/react-core/v2";

type CopilotWorkspaceProps = {
  launchKey: number;
  runtimeUrl: string;
};

export default function CopilotWorkspace({ launchKey, runtimeUrl }: CopilotWorkspaceProps) {
  return (
    <CopilotKit key={`copilot-runtime-${launchKey}`} runtimeUrl={runtimeUrl} credentials="include" showDevConsole={false}>
      <CopilotPopup
        key={launchKey}
        defaultOpen
        width={340}
        height={480}
        labels={{
          modalHeaderTitle: "Copiloto de chamados",
          welcomeMessageText: "Posso listar chamados, prever triagem ou criar um chamado com rastreio.",
          chatInputPlaceholder: "Pergunte sobre SLA, fila ou abertura de chamado..."
        }}
        attachments={{ enabled: true, accept: "image/*", maxSize: 2 * 1024 * 1024 }}
      />
    </CopilotKit>
  );
}
