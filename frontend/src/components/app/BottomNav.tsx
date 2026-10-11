"use client";

import { CircleDollarSign, Clock3, CreditCard, House, UserRound, type LucideIcon } from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { fadeUI, springUI } from "@/lib/motion";
import type { UserMode } from "@/lib/types";
import { homeFor, useSession } from "./SessionProvider";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes that keep this tab active. */
  match?: string[];
}

function tabsFor(mode: UserMode): Tab[] {
  return [
    { href: homeFor(mode), label: "Home", icon: House, match: mode === "DRIVER" ? ["/driver"] : ["/rider"] },
    { href: "/history", label: "Activity", icon: Clock3 },
    mode === "DRIVER"
      ? { href: "/earnings", label: "Earnings", icon: CircleDollarSign }
      : { href: "/payment", label: "Payment", icon: CreditCard },
    { href: "/profile", label: "Profile", icon: UserRound },
  ];
}

export const NAV_HEIGHT = 64;

/** Home, Activity, Payment/Earnings, Profile (DESIGN.md section 5). Translucent material over content. */
export function BottomNav() {
  const pathname = usePathname();
  const { user } = useSession();
  const reduce = useReducedMotion();
  const tabs = tabsFor(user?.mode ?? "RIDER");

  const isActive = (t: Tab) => [t.href, ...(t.match ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));

  return (
    <nav
      aria-label="Main"
      className={cn(
        "relative z-20 shrink-0 border-t border-line pb-[env(safe-area-inset-bottom)]",
        "bg-surface-raised/85 backdrop-blur-xl backdrop-saturate-150",
        "[@media(prefers-reduced-transparency:reduce)]:bg-surface-raised [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
      )}
    >
      <LayoutGroup id="bottom-nav">
        <ul className="flex" style={{ height: NAV_HEIGHT }}>
          {tabs.map((t) => {
            const active = isActive(t);
            const Icon = t.icon;
            return (
              <li key={t.label} className="flex-1">
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-full flex-col items-center justify-center gap-1 text-caption",
                    "transition-[color,transform] duration-150 ease-ui active:scale-95",
                    active ? "text-ink" : "text-ink-muted",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-indicator"
                      aria-hidden
                      transition={reduce ? fadeUI : springUI}
                      className="absolute top-[-1px] h-[3px] w-8 rounded-b-full bg-brand"
                    />
                  )}
                  <Icon aria-hidden size={24} strokeWidth={active ? 2.25 : 2} />
                  <span>{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </LayoutGroup>
    </nav>
  );
}

/** Same footprint as BottomNav, for the prerender fallback (no layout shift). */
export function BottomNavSkeleton() {
  return (
    <div
      aria-hidden
      className="shrink-0 border-t border-line bg-surface-raised pb-[env(safe-area-inset-bottom)]"
      style={{ height: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom))` }}
    />
  );
}
