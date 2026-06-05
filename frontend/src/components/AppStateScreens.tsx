import { FormEvent, useState } from "react";
import { AlertTriangle, KeyRound, LifeBuoy, Loader2, LockKeyhole, UserRound } from "lucide-react";
import { Field } from "./common";

const TEST_REQUESTER_EMAIL = import.meta.env.VITE_TEST_REQUESTER_EMAIL ?? (import.meta.env.DEV ? "solicitante.teste@empresa.local" : "");
const TEST_REQUESTER_PASSWORD = import.meta.env.VITE_TEST_REQUESTER_PASSWORD ?? "";
const ENABLE_TEST_LOGIN = import.meta.env.VITE_ENABLE_TEST_LOGIN === "true" || (import.meta.env.DEV && Boolean(TEST_REQUESTER_EMAIL));

export function BootScreen() {
  return (
    <div className="boot-screen">
      <Loader2 className="spin" size={24} />
      <span>Carregando sessao</span>
    </div>
  );
}

export function CopilotLoadingFallback() {
  return (
    <div className="copilot-loading" role="status">
      <Loader2 className="spin" size={16} />
      <span>Carregando copiloto</span>
    </div>
  );
}

export function LoginScreen({
  onLogin,
  error,
  setError
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  error: string | null;
  setError: (message: string | null) => void;
}) {
  const [email, setEmail] = useState("admin@empresa.local");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await onLogin(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel entrar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand-mark large">
          <LifeBuoy size={24} />
        </div>
        <div>
          <p className="eyebrow">Acesso corporativo</p>
          <h1>Service Desk IA</h1>
          <p>Entre para operar chamados, SLAs, agentes e auditoria.</p>
        </div>
        {error ? (
          <div className="inline-alert compact" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        ) : null}
        <Field label="E-mail corporativo">
          <input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Senha">
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {ENABLE_TEST_LOGIN ? (
          <button
            type="button"
            className="secondary-button wide"
            onClick={() => {
              setEmail(TEST_REQUESTER_EMAIL);
              setPassword(TEST_REQUESTER_PASSWORD);
            }}
            disabled={!TEST_REQUESTER_EMAIL || !TEST_REQUESTER_PASSWORD}
          >
            <UserRound size={18} />
            <span>Usar conta teste</span>
          </button>
        ) : null}
        <button type="submit" className="primary-button wide" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="spin" size={18} /> : <LockKeyhole size={18} />}
          <span>Entrar</span>
        </button>
        <p className="security-note">
          <KeyRound size={15} /> Sessao HttpOnly com controle por perfil.
        </p>
      </form>
    </main>
  );
}

