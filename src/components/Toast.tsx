// Lightweight toast system: ToastProvider context + useToast() hook + ToastViewport.
// Fixed bottom-right stack, auto-dismiss after 5s, manual dismiss via close button.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastVariant = "info" | "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastApi {
  info: (message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  info: "bg-slate-700 border-slate-600 text-slate-100",
  success: "bg-emerald-700 border-emerald-600 text-emerald-50",
  error: "bg-red-700 border-red-600 text-red-50",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef<number>(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message: string, variant: ToastVariant) => {
    const id = nextIdRef.current++;
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      info: (m) => push(m, "info"),
      success: (m) => push(m, "success"),
      error: (m) => push(m, "error"),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <ToastItemView key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItemView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);
  return (
    <div
      role="status"
      className={`flex items-start gap-3 px-3 py-2 rounded-md border shadow-lg text-sm ${VARIANT_STYLES[item.variant]}`}
    >
      <span className="flex-1 break-words">{item.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-xs opacity-80 hover:opacity-100 px-1 leading-none"
      >
        ×
      </button>
    </div>
  );
}
