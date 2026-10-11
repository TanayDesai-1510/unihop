import { cn } from "@/lib/cn";

/** Placeholder block. Size it exactly like the content it stands in for, so nothing shifts on load. */
export function Skeleton({ className, rounded = "md" }: { className?: string; rounded?: "md" | "card" | "full" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block bg-line animate-[skeleton-pulse_1.4s_var(--ease-ui)_infinite]",
        rounded === "full" ? "rounded-full" : rounded === "card" ? "rounded-card" : "rounded-[6px]",
        className,
      )}
    />
  );
}

/** Skeleton matching ListRow's layout (40px leading, title + subtitle, trailing value). */
export function SkeletonListRow({ trailing = true }: { trailing?: boolean }) {
  return (
    <div aria-hidden className="flex min-h-14 items-center gap-3 px-3 py-2">
      <Skeleton rounded="full" className="size-10 shrink-0" />
      <span className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3.5 w-3/5" />
      </span>
      {trailing && <Skeleton className="h-4 w-12" />}
    </div>
  );
}

/** Wraps skeleton content so screen readers hear one "Loading" instead of nothing. */
export function SkeletonGroup({ label = "Loading", children, className }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
