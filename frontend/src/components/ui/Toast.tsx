"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { fadeUI, springUI } from "@/lib/motion";

export type ToastTone = "success" | "error" | "info";

export interface ToastInput {
  tone?: ToastTone;
  message: string;
  /** ms, default 3000 (DESIGN.md). */
  duration?: number;
}

interface ToastItem extends Required<Pick<ToastInput, "message">> {
  id: number;
  tone: ToastTone;
  duration: number;
}

interface ToastApi {
  show(t: ToastInput): void;
  dismiss(): void;
}

const ToastContext = createContext<ToastApi | null>(null);

const noop: ToastApi = { show: () => {}, dismiss: () => {} };

/** Toasts are best-effort: outside a provider (e.g. isolated tests) calls are no-ops. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? noop;
}

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info } as const;
const ICON_COLOR = { success: "text-success", error: "text-danger", info: "text-ink-muted" } as const;

/** One toast at a time, newest wins; top of screen; auto-dismiss; swipe up to dismiss. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const idRef = useRef(0);
  const reduce = useReducedMotion();

  const dismiss = useCallback(() => setToast(null), []);
  const show = useCallback((t: ToastInput) => {
    idRef.current += 1;
    setToast({ id: idRef.current, tone: t.tone ?? "info", message: t.message, duration: t.duration ?? 3000 });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismiss, toast.duration);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  const Icon = toast ? ICONS[toast.tone] : null;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto flex max-w-[430px] justify-center px-5 pt-[calc(env(safe-area-inset-top)+12px)]"
      >
        <AnimatePresence initial={false}>
          {toast && Icon && (
            <motion.div
              key={toast.id}
              role={toast.tone === "error" ? "alert" : undefined}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.96 }}
              transition={reduce ? fadeUI : springUI}
              drag={reduce ? false : "y"}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.6, bottom: 0.1 }}
              onDragEnd={(_, info) => {
                if (info.offset.y < -24 || info.velocity.y < -300) dismiss();
              }}
              onClick={dismiss}
              className={cn(
                "pointer-events-auto flex w-full items-start gap-3 rounded-card bg-surface-raised px-4 py-3",
                "border border-elevated-border shadow-float touch-none",
              )}
            >
              <Icon aria-hidden size={20} strokeWidth={2} className={cn("mt-0.5 shrink-0", ICON_COLOR[toast.tone])} />
              <p className="text-label text-ink">{toast.message}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
