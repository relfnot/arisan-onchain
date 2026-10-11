"use client";

import { createContext, useCallback, useContext, useState } from "react";

export type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
  href?: string;
}

type Push = (toast: Omit<Toast, "id">) => void;

const ToastContext = createContext<Push>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback<Push>(
    (toast) => {
      const id = Date.now() + Math.random();
      setToasts((list) => [...list.slice(-3), { ...toast, id }]);
      setTimeout(() => dismiss(id), toast.kind === "error" ? 9000 : 6000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <div className="toast-text">
              <p className="toast-title">{t.title}</p>
              {t.body && <p className="toast-body">{t.body}</p>}
              {t.href && (
                <a href={t.href} target="_blank" rel="noreferrer">
                  View on Explorer ↗
                </a>
              )}
            </div>
            <button className="toast-close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
