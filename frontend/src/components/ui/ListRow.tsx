"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ListRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Icon (20-24px) or avatar. Wrapped in a 40px slot so rows align. */
  leading?: ReactNode;
  /** Value on the right (price, badge, switch). */
  trailing?: ReactNode;
  chevron?: boolean;
  selected?: boolean;
  /** Renders a Link when set. */
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** 56-64px row: leading icon, title + secondary text, trailing value or chevron (DESIGN.md section 6). */
export function ListRow({ title, subtitle, leading, trailing, chevron, selected, href, onClick, disabled, className, ...aria }: ListRowProps) {
  const interactive = !!href || !!onClick;
  const body = (
    <>
      {leading && (
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            selected ? "bg-brand text-on-brand" : "bg-surface text-ink",
          )}
        >
          {leading}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body font-medium text-ink">{title}</span>
        {subtitle && <span className="truncate text-label font-normal text-ink-muted">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0 text-body text-ink">{trailing}</span>}
      {chevron && <ChevronRight aria-hidden size={20} strokeWidth={2} className="shrink-0 text-ink-muted" />}
    </>
  );
  const classes = cn(
    "flex min-h-14 w-full items-center gap-3 rounded-card px-3 py-2 text-left",
    "transition-[background-color,transform] duration-150 ease-ui",
    selected && "bg-brand-soft",
    interactive && !disabled && "active:scale-[0.99] active:bg-surface",
    disabled && "opacity-40",
    className,
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={classes} aria-label={aria["aria-label"]} aria-current={selected ? "true" : undefined}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={classes} aria-label={aria["aria-label"]} aria-pressed={selected}>
        {body}
      </button>
    );
  }
  return <div className={classes}>{body}</div>;
}
