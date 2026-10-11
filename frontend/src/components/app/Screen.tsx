import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Normal scroll page (history, payment, earnings, profile): Title header with safe-area top,
 * 20px side padding, content scrolls inside the app frame above the bottom nav.
 */
export function Screen({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Top-right control (icon button, toggle). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain">
      <header className="flex items-end justify-between gap-3 px-5 pb-4 pt-[calc(env(safe-area-inset-top)+20px)]">
        <div className="min-w-0">
          <h1 className="text-title text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-label font-normal text-ink-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className={cn("px-5 pb-8", className)}>{children}</div>
    </div>
  );
}
