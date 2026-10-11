"use client";

import { ArrowLeft } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { pressable } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * List-style scroll page (history, payment, earnings, profile). iOS large-title pattern: the
 * Title-size header collapses into a compact blurred top bar as you scroll (opacity + transform
 * only, driven straight from scroll position). Overscroll stretches the title slightly.
 */
export function Screen({
  title,
  subtitle,
  action,
  back,
  children,
  className,
}: {
  title: string;
  /** Back link for screens without the bottom nav (never trap the user). */
  back?: { href: string; label: string };
  subtitle?: ReactNode;
  /** Top-right control (icon button, toggle). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollY } = useScroll({ container: ref });
  const titleOpacity = useTransform(scrollY, [0, 44], [1, 0]);
  const titleScale = useTransform(scrollY, [-120, 0, 44], [1.08, 1, 0.94]);
  const titleY = useTransform(scrollY, [0, 44], [0, -6]);
  const barOpacity = useTransform(scrollY, [30, 54], [0, 1]);

  return (
    <div className="absolute inset-0">
      {/* Compact bar: appears as the large title scrolls away. Purely visual (aria-hidden). */}
      <motion.div
        aria-hidden
        style={{ opacity: barOpacity }}
        className="glass-bar pointer-events-none absolute inset-x-0 top-0 z-10 flex items-end justify-center px-12 pb-2.5 pt-[calc(env(safe-area-inset-top)+10px)]"
      >
        <span className="truncate text-headline text-ink">{title}</span>
      </motion.div>

      <div ref={ref} className="absolute inset-0 overflow-y-auto overscroll-contain">
        {back && (
          <motion.div {...pressable} className="absolute left-3 top-[calc(env(safe-area-inset-top)+8px)] z-20">
            <Link href={back.href} aria-label={back.label} className="flex size-11 items-center justify-center rounded-full text-ink">
              <ArrowLeft aria-hidden size={22} strokeWidth={2} />
            </Link>
          </motion.div>
        )}
        <header className={cn("flex items-end justify-between gap-3 px-5 pb-5", back ? "pt-[calc(env(safe-area-inset-top)+60px)]" : "pt-[calc(env(safe-area-inset-top)+24px)]")}>
          <motion.div className="min-w-0 origin-bottom-left" style={reduce ? { opacity: titleOpacity } : { opacity: titleOpacity, scale: titleScale, y: titleY }}>
            <h1 className="text-title text-ink">{title}</h1>
            {subtitle && <div className="mt-1 text-label font-normal text-ink-muted">{subtitle}</div>}
          </motion.div>
          {action}
        </header>
        <div className={cn("px-5 pb-10", className)}>{children}</div>
      </div>
    </div>
  );
}
