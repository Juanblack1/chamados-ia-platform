import { ChangeEvent, FormEvent, useState } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, FileSearch, ImagePlus, Loader2, Send, X } from "lucide-react";
import type { AppUser, CreateTicketPayload, IntakeAssessment, ServiceDeskCatalog, TicketPriority } from "../../lib/api";
import {
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  assessmentTone,
  canOpenTicketForOthers,
  estimatedGroup,
  estimatedPriority,
  priorityLabel,
  readinessLabel,
  statusLabel
} from "../../lib/presentation";
import { AnalysisItem, Badge, Field, SkeletonRows } from "../../components/common";

export function IntakeView({
  user,
  form,
  setForm,
  templates,
  groups,
  assessment,
  isAssessing,
  isSubmitting,
  onAssess,
  onSubmit
}: {
  user: AppUser;
  form: CreateTicketPayload;
  setForm: (form: CreateTicketPayload) => void;
  templates: ServiceDeskCatalog["openingTemplates"];
  groups: ServiceDeskCatalog["groups"];
  assessment: IntakeAssessment | null;
  isAssessing: boolean;
  isSubmitting: boolean;
  onAssess: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const remainingAttachments = MAX_ATTACHMENTS - form.attachments.length;
  const shouldBlockCreate = Boolean(assessment && !assessment.shouldCreate);
  const canChooseRequester = canOpenTicketForOthers(user);
  const selectedTemplate = templates.find((template) => template.affectedService === form.affectedService);
  const [attachmentNotice, setAttachmentNotice] = useState<string | null>(null);

  async function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    const rejectedByType = files.length - imageFiles.length;
    const allowedImages = imageFiles.filter((file) => file.size <= MAX_ATTACHMENT_BYTES);
    const rejectedBySize = imageFiles.length - allowedImages.length;
    const acceptedImages = allowedImages.slice(0, Math.max(remainingAttachments, 0));
    const rejectedByLimit = allowedImages.length - acceptedImages.length;

    if (acceptedImages.length > 0) {
      const encoded = await Promise.all(acceptedImages.map(readFileAsDataUrl));
      setForm({ ...form, attachments: [...form.attachments, ...encoded] });
    }

    const notices = [
      rejectedByType ? `${rejectedByType} arquivo(s) ignorado(s): use PNG, JPG, WebP ou GIF.` : null,
      rejectedBySize ? `${rejectedBySize} imagem(ns) acima de 2 MB.` : null,
      rejectedByLimit ? `Limite de ${MAX_ATTACHMENTS} imagens atingido.` : null,
      acceptedImages.length ? `${acceptedImages.length} imagem(ns) anexada(s).` : null
    ].filter(Boolean);
    setAttachmentNotice(notices.length ? notices.join(" ") : null);

    event.target.value = "";
  }

  function removeAttachment(index: number) {
    setForm({ ...form, attachments: form.attachments.filter((_, currentIndex) => currentIndex !== index) });
  }

  return (
    <form className="intake-layout" onSubmit={onSubmit}>
      <section className="panel intake-form" aria-labelledby="intake-title">
        <div className="panel-heading">
          <div>
            <h2 id="intake-title">Dados do chamado</h2>
            <p>A triagem calcula prioridade por urgencia e impacto e registra rastreio da IA.</p>
          </div>
        </div>
        <div className="form-grid">
          <Field label="Tipo">
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as "incident" | "request" })}>
              <option value="incident">Incidente</option>
              <option value="request">Solicitacao</option>
            </select>
          </Field>
          <Field label="Solicitante">
            <input
              required
              type="email"
              disabled={!canChooseRequester}
              value={canChooseRequester ? form.requesterEmail : user.email}
              onChange={(event) => setForm({ ...form, requesterEmail: event.target.value })}
            />
          </Field>
          <Field label="Departamento">
            <input required value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} />
          </Field>
          <Field label="Servico afetado">
            <select value={form.affectedService} onChange={(event) => setForm({ ...form, affectedService: event.target.value })}>
              {(templates.length ? templates : fallbackTemplates).map((template) => (
                <option key={template.affectedService} value={template.affectedService}>
                  {template.affectedService} - {template.category}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Titulo" wide>
            <input
              required
              minLength={6}
              maxLength={120}
              placeholder={selectedTemplate?.titlePlaceholder}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </Field>
          <Field label="Descricao" wide>
            <textarea
              required
              minLength={20}
              placeholder={selectedTemplate?.descriptionPrompt}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
          <Field label="Urgencia">
            <select value={form.urgency} onChange={(event) => setForm({ ...form, urgency: event.target.value as TicketPriority })}>
              <option value="low">Baixa</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Critica</option>
            </select>
          </Field>
          <Field label="Impacto operacional">
            <select value={form.impact} onChange={(event) => setForm({ ...form, impact: event.target.value as TicketPriority })}>
              <option value="low">Baixo</option>
              <option value="medium">Medio</option>
              <option value="high">Alto</option>
              <option value="critical">Critico</option>
            </select>
          </Field>
          <Field label="Impacto no negocio" wide>
            <input
              required
              placeholder={selectedTemplate?.businessImpactPrompt}
              value={form.businessImpact}
              onChange={(event) => setForm({ ...form, businessImpact: event.target.value })}
            />
          </Field>
          {selectedTemplate ? (
            <div className="template-guide wide">
              <div>
                <strong>Template {selectedTemplate.category}</strong>
                <span>Grupo sugerido: {groups.find((group) => group.id === selectedTemplate.assignedGroupId)?.name ?? "Nao definido"}</span>
              </div>
              <ul>
                {selectedTemplate.requiredFields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="field wide">
            <span>Imagens</span>
            <label className="attachment-drop">
              <ImagePlus size={22} />
              <strong>Anexar evidencia visual</strong>
              <small>PNG, JPG, WebP ou GIF ate 2 MB. Limite de {MAX_ATTACHMENTS} imagens.</small>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple disabled={remainingAttachments <= 0} onChange={handleAttachmentChange} />
            </label>
            {attachmentNotice ? <small className="field-note" role="status">{attachmentNotice}</small> : null}
            {form.attachments.length ? (
              <div className="attachment-grid" aria-label="Imagens anexadas">
                {form.attachments.map((attachment, index) => (
                  <div className="attachment-thumb" key={`${attachment.slice(0, 40)}-${index}`}>
                    <img src={attachment} alt={`Anexo ${index + 1}`} />
                    <button type="button" className="remove-attachment" onClick={() => removeAttachment(index)} aria-label={`Remover anexo ${index + 1}`}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="sticky-actions">
          <button type="button" className="secondary-button" disabled={isSubmitting || isAssessing} onClick={onAssess}>
            {isAssessing ? <Loader2 className="spin" size={18} /> : <FileSearch size={18} />}
            <span>Analisar chamado</span>
          </button>
          <button type="submit" className="primary-button" disabled={isSubmitting || isAssessing || shouldBlockCreate}>
            {isSubmitting ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
            <span>Criar chamado</span>
          </button>
        </div>
      </section>
      <IntakeIntelligencePanel
        form={form}
        assessment={assessment}
        isAssessing={isAssessing}
        onApplySuggestion={() => {
          if (!assessment) return;
          setForm({
            ...form,
            type: assessment.suggestedFields.type,
            title: assessment.suggestedFields.title ?? form.title,
            affectedService: assessment.suggestedFields.affectedService,
            urgency: assessment.suggestedFields.urgency,
            impact: assessment.suggestedFields.impact
          });
        }}
      />
    </form>
  );
}

function IntakeIntelligencePanel({
  form,
  assessment,
  isAssessing,
  onApplySuggestion
}: {
  form: CreateTicketPayload;
  assessment: IntakeAssessment | null;
  isAssessing: boolean;
  onApplySuggestion: () => void;
}) {
  const localPriority = estimatedPriority(form);

  return (
    <section className="panel ai-panel" aria-labelledby="intake-ai-title">
      <div className="panel-heading">
        <div>
          <h2 id="intake-ai-title">Intake inteligente</h2>
          <p>Analise antes da abertura com RAG, similares, campos sugeridos e bloqueio de chamados vagos.</p>
        </div>
        {assessment ? <Badge tone={assessmentTone(assessment)}>{readinessLabel(assessment.readiness)}</Badge> : null}
      </div>
      {isAssessing ? (
        <div className="analysis-list">
          <div className="intake-loading">
            <Loader2 className="spin" size={18} />
            <span>Analisando qualidade, RAG e similares</span>
          </div>
          <SkeletonRows />
        </div>
      ) : assessment ? (
        <div className="analysis-list">
          <div className="quality-block">
            <div className="quality-header">
              <strong>{assessment.qualityScore}/100</strong>
              <span>{assessment.summary}</span>
            </div>
            <div className="quality-meter" aria-label={`Qualidade do chamado ${assessment.qualityScore} de 100`}>
              <span style={{ width: `${assessment.qualityScore}%` }} />
            </div>
          </div>

          {assessment.selfService.canDeflect ? (
            <div className="self-service-box">
              <div className="heading-inline">
                <BookOpen size={17} />
                <h3>Autoatendimento encontrado</h3>
              </div>
              <p>{assessment.selfService.answer}</p>
            </div>
          ) : null}

          {assessment.missingInformation.length ? (
            <div className="intake-list">
              <h3>Faltando para abrir</h3>
              <ul>
                {assessment.missingInformation.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {assessment.clarificationQuestions.length ? (
            <div className="intake-list">
              <h3>Perguntas sugeridas</h3>
              <ul>
                {assessment.clarificationQuestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="suggestion-card">
            <div>
              <strong>{assessment.suggestedFields.category}</strong>
              <span>{priorityLabel(assessment.suggestedFields.priority)} - {assessment.suggestedFields.assignedGroupName}</span>
            </div>
            <button type="button" className="secondary-button small" onClick={onApplySuggestion}>
              <CheckCircle2 size={16} />
              <span>Aplicar sugestao</span>
            </button>
          </div>

          <div className="quality-signals">
            {assessment.qualitySignals.map((signal) => (
              <div className={`quality-signal ${signal.status}`} key={signal.label}>
                {signal.status === "ok" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                <div>
                  <strong>{signal.label}</strong>
                  <span>{signal.detail}</span>
                </div>
              </div>
            ))}
          </div>

          {assessment.ragSources.length ? (
            <div className="intake-list">
              <h3>RAG usado</h3>
              {assessment.ragSources.slice(0, 3).map((source) => (
                <article className="compact-source" key={source.id}>
                  <strong>{source.title}</strong>
                  <span>{source.source} - {Math.round(source.relevance * 100)}%</span>
                </article>
              ))}
            </div>
          ) : null}

          {assessment.similarTickets.length ? (
            <div className="intake-list">
              <h3>Chamados parecidos</h3>
              {assessment.similarTickets.map((ticket) => (
                <article className="compact-source" key={ticket.id}>
                  <strong>{ticket.number} - {ticket.title}</strong>
                  <span>{statusLabel(ticket.status)} - {ticket.affectedService} - {Math.round(ticket.score * 100)}%</span>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="analysis-list">
          <AnalysisItem label="Prioridade local" value={priorityLabel(localPriority)} />
          <AnalysisItem label="SLA local" value={localPriority === "critical" ? "P1 - resposta em 15 min" : localPriority === "high" ? "P2 - resposta em 1 h" : "P3/P4 - fila padrao"} />
          <AnalysisItem label="Grupo local" value={estimatedGroup(form)} />
          <AnalysisItem label="Controle" value="A analise IA roda antes de criar o chamado" />
        </div>
      )}
    </section>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
    reader.readAsDataURL(file);
  });
}

const fallbackTemplates = [
  { affectedService: "ERP Central", category: "ERP" },
  { affectedService: "Rede Corporativa", category: "Rede" },
  { affectedService: "Identity Access", category: "Identidade" },
  { affectedService: "Portal Cliente", category: "Portal" },
  { affectedService: "APIs Corporativas", category: "APIs" },
  { affectedService: "Hardware", category: "Hardware" },
  { affectedService: "Aprovacoes", category: "Aprovacoes" }
];
