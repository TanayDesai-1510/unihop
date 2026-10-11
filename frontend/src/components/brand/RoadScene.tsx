import { cn } from "@/lib/cn";

export type RoadSceneVariant = "pin" | "ticket" | "coins" | "search";

/**
 * Illustrated empty states from the road motif (DESIGN.md section 3b): a winding dashed road that
 * ends at an object, drawn in SVG with tokens only so it adapts to light and dark.
 */
export function RoadScene({ variant = "pin", className }: { variant?: RoadSceneVariant; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 200 140" className={cn("h-[120px] w-auto", className)} fill="none">
      {/* ground */}
      <ellipse cx="100" cy="124" rx="84" ry="10" style={{ fill: "var(--surface)" }} />
      {/* road body + lanes, winding from bottom-left toward the object */}
      <path d="M20 128c22-6 40-14 46-30s-6-26 10-38 46-8 58-22" style={{ stroke: "var(--line)" }} strokeWidth="18" strokeLinecap="round" />
      <path d="M20 128c22-6 40-14 46-30s-6-26 10-38 46-8 58-22" style={{ stroke: "var(--surface-raised)" }} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="0.1 9" />
      <path d="M14 121c22-6 40-14 46-30s-6-26 10-38 46-8 58-22" style={{ stroke: "var(--accent)" }} strokeOpacity="0.85" strokeWidth="3" strokeLinecap="round" />
      {variant === "pin" && (
        <g transform="translate(130 14)">
          <path d="M18 46c-1 0-1.6-.4-2.2-1.2C9.6 36.6 2 27.8 2 19.4 2 10 9.2 2 18 2s16 8 16 17.4c0 8.4-7.6 17.2-13.8 25.4-.6.8-1.2 1.2-2.2 1.2Z" style={{ fill: "var(--brand)" }} />
          <circle cx="18" cy="18.5" r="6" style={{ fill: "var(--surface-raised)" }} />
        </g>
      )}
      {variant === "ticket" && (
        <g transform="translate(126 6) rotate(8)">
          <rect x="0" y="0" width="48" height="34" rx="6" style={{ fill: "var(--brand)" }} />
          <circle cx="0" cy="17" r="4" style={{ fill: "var(--bg)" }} />
          <circle cx="48" cy="17" r="4" style={{ fill: "var(--bg)" }} />
          <path d="M8 17h32" style={{ stroke: "var(--surface-raised)" }} strokeWidth="2" strokeLinecap="round" strokeDasharray="0.1 5" />
          <rect x="8" y="7" width="18" height="4" rx="2" style={{ fill: "var(--surface-raised)" }} opacity="0.85" />
          <rect x="8" y="23" width="12" height="4" rx="2" style={{ fill: "var(--accent)" }} />
        </g>
      )}
      {variant === "coins" && (
        <g transform="translate(130 10)">
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(0 ${24 - i * 9})`}>
              <ellipse cx="20" cy="14" rx="18" ry="6" style={{ fill: "var(--brand-strong)" }} />
              <ellipse cx="20" cy="11" rx="18" ry="6" style={{ fill: "var(--brand)" }} />
            </g>
          ))}
          <path d="M14 -6v8M20 -10v10M26 -6v8" style={{ stroke: "var(--accent)" }} strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}
      {variant === "search" && (
        <g transform="translate(132 8)">
          <circle cx="16" cy="16" r="13" style={{ stroke: "var(--brand)" }} strokeWidth="5" />
          <path d="M26 26l10 10" style={{ stroke: "var(--brand)" }} strokeWidth="6" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
