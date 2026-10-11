"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { springPress } from "@/lib/motion";
import { Spinner } from "./Spinner";
import { useToast } from "./Toast";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger-outline";
export type ButtonSize = "lg" | "md";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-brand active:bg-brand-strong",
  // UniHop orange: only the one hero CTA per screen ("Request UniHop", "Accept"). DESIGN.md section 6.
  accent: "bg-accent text-on-accent",
  secondary: "bg-surface text-ink",
  ghost: "bg-transparent text-ink",
  "danger-outline": "bg-transparent text-danger border-2 border-danger",
};

const SIZES: Record<ButtonSize, string> = {
  lg: "h-[52px] px-5 text-headline",
  md: "h-11 px-4 text-label font-semibold",
};

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width by default (DESIGN.md). */
  block?: boolean;
  loading?: boolean;
  /**
   * When set, the button looks disabled but still responds to taps by explaining why
   * (DESIGN.md section 10: "disabled buttons that explain why when tapped").
   */
  disabledReason?: string | null;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "lg",
    block = true,
    loading = false,
    disabled,
    disabledReason,
    leadingIcon,
    trailingIcon,
    className,
    onClick,
    type = "button",
    children,
    ...rest
  },
  ref,
) {
  const toast = useToast();
  const softDisabled = !disabled && !!disabledReason;
  const inert = disabled || loading || softDisabled;

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-disabled={inert || undefined}
      aria-busy={loading || undefined}
      whileTap={inert ? undefined : { scale: 0.98 }}
      transition={springPress}
      onClick={(e) => {
        if (loading) return;
        if (softDisabled) {
          e.preventDefault();
          toast.show({ tone: "info", message: disabledReason! });
          return;
        }
        onClick?.(e);
      }}
      className={cn(
        "relative inline-flex select-none items-center justify-center gap-2 rounded-button",
        "transition-[opacity,background-color] duration-150 ease-ui",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        VARIANTS[variant],
        SIZES[size],
        block && "w-full",
        (disabled || softDisabled) && "opacity-40",
        disabled && "cursor-not-allowed",
        className,
      )}
      {...rest}
    >
      {/* Content keeps its width while loading so the button never resizes. */}
      <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>
        {leadingIcon}
        {children}
        {trailingIcon}
      </span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
          <span className="sr-only">Loading</span>
        </span>
      )}
    </motion.button>
  );
});
