import Image from "next/image";
import { cn } from "@/lib/cn";

export interface LogoProps {
  /**
   * "icon": the full navy rounded-square app icon.
   * "mark": the pin + cap + road artwork. The extracted mark is white, so it only reads on dark or
   *   navy surfaces: in light mode it falls back to the full icon (DESIGN.md section 2 allows the
   *   full icon at small sizes), in dark mode it shows the mark (no navy icon on a navy surface).
   */
  variant?: "icon" | "mark";
  /** Rendered width and height in px. */
  size?: number;
  /** Always show the white mark, for navy/brand surfaces (splash) regardless of color scheme. */
  onBrand?: boolean;
  /** Load eagerly (above-the-fold logos). */
  priority?: boolean;
  className?: string;
}

const ICON = "/brand/icon.png";
const MARK = "/brand/mark@2x.png";

/** The UniHop logo from the generated assets. Never recolored, stretched, rotated, or redrawn. */
export function Logo({ variant = "mark", size = 32, onBrand = false, priority, className }: LogoProps) {
  const img = (src: string, extra?: string) => (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      priority={priority}
      draggable={false}
      className={cn("select-none", extra)}
      style={{ width: size, height: size }}
    />
  );

  let content;
  if (variant === "icon") content = img(ICON);
  else if (onBrand) content = img(MARK);
  else
    content = (
      <>
        {img(ICON, "dark:hidden")}
        {img(MARK, "hidden dark:block")}
      </>
    );

  return (
    <span role="img" aria-label="UniHop" className={cn("inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      {content}
    </span>
  );
}
