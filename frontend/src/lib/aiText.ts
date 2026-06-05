export function localizeAgentContent(content: string): string {
  const knownTranslations = [
    {
      pattern: /^I understand you're experiencing a login issue with the ERP Central system\. To help resolve this, please provide the exact type of login problem \(e\.g\., password issue, locked account, MFA error\), the complete error message you are receiving, and confirm your identity for validation\.$/i,
      replacement: "Entendi que ha um problema de login no ERP Central. Para resolver, informe o tipo exato da falha (senha, conta bloqueada ou MFA), a mensagem de erro completa e confirme sua identidade para validacao."
    },
    {
      pattern: /^Routing agent assigned\s+(.+?)\s+to\s+(.+?)\.$/i,
      replacement: "Agente de roteamento direcionou $1 para $2."
    },
    {
      pattern: /^SLA risk agent marked risk as\s+(.+?)\s+for\s+(.+?)\s+priority\. Evidence:\s*(.+)$/i,
      replacement: "Agente de SLA marcou risco $1 para prioridade $2. Evidencia: $3"
    }
  ];
  const translated = knownTranslations.reduce((current, item) => current.replace(item.pattern, item.replacement), content);

  return translated
    .replace(/\bIntake ready\b/gi, "Intake pronto")
    .replace(/\bPrediction\b/gi, "Previsao")
    .replace(/\bIncident\b/gi, "Incidente")
    .replace(/\bRequest\b/gi, "Solicitacao")
    .replace(/\bpriority critical\b/gi, "prioridade critica")
    .replace(/\bpriority high\b/gi, "prioridade alta")
    .replace(/\bpriority medium\b/gi, "prioridade media")
    .replace(/\bpriority low\b/gi, "prioridade baixa")
    .replace(/\bcritical priority\b/gi, "prioridade critica")
    .replace(/\bhigh priority\b/gi, "prioridade alta")
    .replace(/\bmedium priority\b/gi, "prioridade media")
    .replace(/\blow priority\b/gi, "prioridade baixa")
    .replace(/\bnormal\b/gi, "normal")
    .replace(/\bwatch\b/gi, "em observacao")
    .replace(/\bescalate\b/gi, "escalacao")
    .replace(/\bEvidence:\b/gi, "Evidencia:")
    .replace(/\bassigned\b/gi, "direcionou")
    .replace(/\bto\b/gi, "para");
}
