"use client";

import { CircleCheck, Plus } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { PaymentBadge } from "@/components/ui/Badge";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { pressable } from "@/lib/motion";
import type { PaymentMethod } from "@/lib/types";

/** "Pay with" picker for the ride options panel (issue #34). Picking a method closes the sheet. */
export function MethodSheet({
  open,
  onClose,
  methods,
  selectedId,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  methods: PaymentMethod[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Pay with" description="You're only charged when the ride ends.">
      <div role="radiogroup" aria-label="Payment method" className="-mx-3 flex flex-col">
        {methods.map((m) => {
          const on = m.id === selectedId;
          return (
            <motion.button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              {...pressable}
              onClick={() => {
                haptic("tick");
                onSelect(m.id);
                onClose();
              }}
              className={cn("flex min-h-14 items-center gap-3 rounded-card px-3 py-2 text-left", on && "bg-brand-soft")}
            >
              <PaymentBadge brand={m.brand} type={m.type} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-medium text-ink">{m.nickname ?? m.label}</span>
                <span className="block truncate text-label font-normal text-ink-muted">
                  {[
                    m.type !== "CARD" ? `${m.brand[0]}${m.brand.slice(1).toLowerCase()} •••• ${m.last4}` : m.nickname ? m.label : null,
                    m.type === "CARD" ? `Expires ${String(m.expMonth).padStart(2, "0")}/${String(m.expYear).slice(-2)}` : null,
                    m.isDefault ? "Default" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              {on && <CircleCheck aria-hidden size={22} strokeWidth={2} className="shrink-0 text-brand" />}
            </motion.button>
          );
        })}
        <Link href="/payment/add?next=/rider" className="flex min-h-14 items-center gap-3 rounded-card px-3 py-2 text-body font-semibold text-brand active:bg-surface">
          <span className="flex h-6 w-12 items-center justify-center">
            <Plus aria-hidden size={20} strokeWidth={2} />
          </span>
          Add a card
        </Link>
      </div>
    </Sheet>
  );
}
