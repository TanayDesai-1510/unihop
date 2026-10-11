"use client";

import { AnimatePresence, motion, useDragControls, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { fadeUI, projectMomentum, springSmooth } from "@/lib/motion";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Short line under the title. */
  description?: ReactNode;
  children: ReactNode;
  /** Visual style: default surface, or a dark sheet (Apple Pay style). */
  tone?: "default" | "dark";
  className?: string;
}

/**
 * Modal bottom sheet (actions, top-up, add method, wallet confirmations). Slides up on a spring,
 * drag down or flick to dismiss, backdrop tap and Escape close it. A real dialog: focus moves in,
 * Tab stays inside, focus returns to the trigger on close. One at a time (no sheet on sheet).
 */
export function Sheet({ open, onClose, title, description, children, tone = "default", className }: SheetProps) {
  const reduce = useReducedMotion();
  const controls = useDragControls();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const first = panel.current?.querySelector<HTMLElement>("button:not([disabled]), [href], input, [tabindex]:not([tabindex='-1'])");
      (first ?? panel.current)?.focus();
    }, 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])")];
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      restore.current?.focus?.();
    };
  }, [open, onClose]);

  const dark = tone === "dark";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[900] mx-auto flex max-w-[430px] flex-col justify-end">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.45 }}
            exit={{ opacity: 0 }}
            transition={fadeUI}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={reduce ? fadeUI : springSmooth}
            drag={reduce ? false : "y"}
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y + projectMomentum(info.velocity.y, 0.99) > 140) onClose();
            }}
            className={cn(
              "relative max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-sheet px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] outline-none",
              dark ? "bg-[var(--wallet-dark)] text-[var(--wallet-dark-ink)]" : "border-t border-elevated-border bg-surface-raised text-ink shadow-[var(--shadow-sheet)]",
              className,
            )}
          >
            <div className="touch-none pb-2 pt-1" onPointerDown={(e) => !reduce && controls.start(e)}>
              <span className={cn("mx-auto block h-1 w-9 rounded-full", dark ? "bg-[var(--wallet-dark-ink)]/30" : "bg-ink-muted/30")} />
              {title && (
                <h2 id={titleId} className="mt-4 text-title">
                  {title}
                </h2>
              )}
              {description && <p className={cn("mt-1 text-label font-normal", dark ? "opacity-70" : "text-ink-muted")}>{description}</p>}
            </div>
            <div className="pt-3">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
