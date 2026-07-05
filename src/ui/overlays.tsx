// Toasts + confirmations — retours d'action immédiats et non bloquants.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { Button } from "./components";

/* ================= Toasts ================= */
type ToastType = "success" | "error" | "info";
type Toast = { id: number; message: string; type: ToastType };

type ConfirmOpts = { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type PromptOpts = { title: string; message?: string; label?: string; placeholder?: string; confirmLabel?: string; minLen?: number; danger?: boolean };

type UICtx = {
  toast: (message: string, type?: ToastType) => void;
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  prompt: (opts: PromptOpts) => Promise<string | null>;
};

const Ctx = createContext<UICtx | null>(null);

export function useUI(): UICtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useUI must be used within <UIProvider>");
  return c;
}

const TOAST_ICON = { success: <CheckCircle2 size={18} />, error: <AlertTriangle size={18} />, info: <Info size={18} /> };

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);
  const [confirmState, setConfirmState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const [promptState, setPromptState] = useState<(PromptOpts & { resolve: (v: string | null) => void }) | null>(null);
  const [promptVal, setPromptVal] = useState("");

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = idRef.current++;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const confirm = useCallback((opts: ConfirmOpts) => {
    return new Promise<boolean>((resolve) => setConfirmState({ ...opts, resolve }));
  }, []);

  const prompt = useCallback((opts: PromptOpts) => {
    setPromptVal("");
    return new Promise<string | null>((resolve) => setPromptState({ ...opts, resolve }));
  }, []);

  function close(v: boolean) {
    confirmState?.resolve(v);
    setConfirmState(null);
  }
  function closePrompt(v: string | null) {
    promptState?.resolve(v);
    setPromptState(null);
    setPromptVal("");
  }

  return (
    <Ctx.Provider value={{ toast, confirm, prompt }}>
      {children}

      <div className="ds-toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`ds-toast ds-toast--${t.type}`}>
            {TOAST_ICON[t.type]}
            <span style={{ flex: 1 }}>{t.message}</span>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-mute)", display: "grid" }}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="ds-overlay" onClick={() => close(false)}>
          <div className="ds-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ds-modal-ico" style={{
              background: confirmState.danger ? "var(--danger-bg)" : "var(--info-bg)",
              color: confirmState.danger ? "var(--danger)" : "var(--info)",
            }}>
              <AlertTriangle size={24} />
            </div>
            <h3 className="ds-modal-title">{confirmState.title}</h3>
            {confirmState.message && <p className="ds-modal-text">{confirmState.message}</p>}
            <div className="ds-modal-actions">
              <Button variant="secondary" onClick={() => close(false)}>{confirmState.cancelLabel || "Annuler"}</Button>
              <Button variant={confirmState.danger ? "danger" : "primary"} onClick={() => close(true)}>
                {confirmState.confirmLabel || "Confirmer"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {promptState && (
        <div className="ds-overlay" onClick={() => closePrompt(null)}>
          <div className="ds-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ds-modal-ico" style={{
              background: promptState.danger ? "var(--danger-bg)" : "var(--info-bg)",
              color: promptState.danger ? "var(--danger)" : "var(--info)",
            }}>
              <AlertTriangle size={24} />
            </div>
            <h3 className="ds-modal-title">{promptState.title}</h3>
            {promptState.message && <p className="ds-modal-text">{promptState.message}</p>}
            <label className="ds-label" style={{ display: "block", margin: "16px 0 6px" }}>{promptState.label || "Justification"}</label>
            <textarea className="ds-textarea" rows={3} autoFocus
              placeholder={promptState.placeholder || "Motivez votre décision…"}
              value={promptVal} onChange={(e) => setPromptVal(e.target.value)} />
            <div className="ds-modal-actions">
              <Button variant="secondary" onClick={() => closePrompt(null)}>Annuler</Button>
              <Button variant={promptState.danger ? "danger" : "primary"}
                disabled={promptVal.trim().length < (promptState.minLen ?? 4)}
                onClick={() => closePrompt(promptVal.trim())}>
                {promptState.confirmLabel || "Valider"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
