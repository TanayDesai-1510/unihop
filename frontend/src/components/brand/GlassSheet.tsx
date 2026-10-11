"use client";

import { BottomSheet, type BottomSheetProps } from "@/components/ui/BottomSheet";
import { cn } from "@/lib/cn";

/**
 * Bottom sheet over the map (DESIGN.md section 3b): surface-raised at 92% with a 20px blur and
 * a hairline top border, so the map reads through at the edges. iOS-style detents, momentum
 * snapping, rubber-banding and a slight map dim only at the full detent come from BottomSheet.
 */
export function GlassSheet({ className, ...props }: BottomSheetProps) {
  return <BottomSheet {...props} className={cn("glass-sheet", className)} />;
}
