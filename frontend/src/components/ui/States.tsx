"use client";

import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

/** Friendly empty message plus one action (DESIGN.md section 10). */
export function EmptyState({
  icon,
  title,
  message,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-10 text-center", className)}>
      <span className="flex size-14 items-center justify-center rounded-full bg-surface text-ink">{icon}</span>
      <h2 className="text-headline text-ink">{title}</h2>
      {message && <p className="max-w-[280px] text-label font-normal text-ink-muted">{message}</p>}
      {action && (
        <Button variant="secondary" size="md" block={false} className="mt-2" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

/** Error message plus retry. Says what happened and what to do. */
export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 px-6 py-10 text-center", className)}>
      <span className="flex size-14 items-center justify-center rounded-full bg-surface text-danger">
        <CircleAlert aria-hidden size={24} strokeWidth={2} />
      </span>
      <p className="max-w-[280px] text-body text-ink">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="md" block={false} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
