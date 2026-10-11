"use client";

import { Power } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { PRESS_SCALE, fadeUI, springSmooth, springSnappy } from "@/lib/motion";
import { Spinner } from "@/components/ui/Spinner";

/**
 * The big online/offline toggle (DESIGN.md section 8): offline is quiet ink-muted, online is a
 * brand fill with a soft accent glow and a live dot. One large target; the knob springs across.
 */
export function OnlineToggle({ online, pending, onToggle }: { online: boolean; pending: boolean; onToggle: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={online}
      aria-busy={pending || undefined}
      onClick={onToggle}
      whileTap={{ scale: PRESS_SCALE }}
      transition={springSnappy}
      className={cn(
        "relative flex h-[68px] w-full items-center gap-3 overflow-hidden rounded-full p-1.5 text-left transition-[background-color,box-shadow] duration-300",
        online ? "bg-brand text-on-brand shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_22%,transparent),0_10px_30px_color-mix(in_srgb,var(--accent)_30%,transparent)]" : "bg-surface text-ink",
      )}
    >
      <motion.span
        layout
        transition={reduce ? fadeUI : springSmooth}
        className={cn("relative z-10 flex size-14 shrink-0 items-center justify-center rounded-full", online ? "order-2 ml-auto bg-on-brand text-brand" : "order-1 bg-surface-raised text-ink-muted shadow-[var(--shadow-float)]")}
      >
        {pending ? <Spinner size={22} /> : <Power aria-hidden size={24} strokeWidth={2.25} />}
      </motion.span>
      <span className={cn("flex min-w-0 flex-col px-2", online ? "order-1" : "order-2")}>
        <span className="text-headline">{online ? "You're online" : "Go online"}</span>
        <span className={cn("flex items-center gap-1.5 text-label font-normal", online ? "text-on-brand/80" : "text-ink-muted")}>
          {online && (
            <span aria-hidden className="relative flex size-2">
              <span className="absolute inset-0 animate-[status-ping_1.6s_var(--ease-ui)_infinite] rounded-full bg-accent" />
              <span className="relative size-2 rounded-full bg-accent" />
            </span>
          )}
          {online ? "Finding trips near you" : "You're offline"}
        </span>
      </span>
    </motion.button>
  );
}
