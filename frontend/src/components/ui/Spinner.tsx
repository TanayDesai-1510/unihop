import { cn } from "@/lib/cn";

/** Small inline spinner for loading buttons. Never used alone on a blank page (use Skeleton). */
export function Spinner({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("animate-[spin_0.8s_linear_infinite]", className)}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
