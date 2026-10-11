"use client";

import { animate, motion, useDragControls, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { fadeUI, projectMomentum, springSheet } from "@/lib/motion";

/** Visible height of the sheet: px, or a percentage of the container ("50%"). Ascending order. */
export type SnapPoint = number | `${number}%`;

export interface BottomSheetProps {
  /** Ascending visible heights, e.g. [160, "50%", "92%"] for peek / half / full. */
  snapPoints: SnapPoint[];
  /** Index into snapPoints to open at. Defaults to the lowest. */
  defaultSnap?: number;
  /** Controlled snap index. */
  snap?: number;
  onSnapChange?: (index: number) => void;
  /** Allow dragging below the lowest snap to close. */
  dismissible?: boolean;
  onDismiss?: () => void;
  /** Sticky area under the handle (title, summary). Always draggable. */
  header?: ReactNode;
  children?: ReactNode;
  "aria-label": string;
  className?: string;
}

const TOP_RUBBER_BAND = 0.18;

/**
 * Map-over-sheet pattern (DESIGN.md section 5). Place inside a `relative` full-height container.
 * Physical and interruptible: grab it mid-flight, flick it, it lands where the flick projects.
 */
export function BottomSheet({
  snapPoints,
  defaultSnap = 0,
  snap,
  onSnapChange,
  dismissible = false,
  onDismiss,
  header,
  children,
  className,
  ...aria
}: BottomSheetProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const controls = useDragControls();
  const reduce = useReducedMotion();
  const [containerH, setContainerH] = useState(0);
  const [index, setIndex] = useState(snap ?? defaultSnap);
  const y = useMotionValue(10_000); // off-screen until measured

  const heights = snapPoints.map((p) => resolve(p, containerH));
  const maxH = heights[heights.length - 1] ?? 0;
  const yFor = useCallback((i: number) => maxH - heights[i], [maxH, heights]);
  const topIndex = snapPoints.length - 1;
  const atTop = index === topIndex;
  const hasBackdrop = snapPoints.length > 1 && containerH > 0;

  // Backdrop fades in only across the last stretch, between the second-highest snap and full.
  const backdropFrom = snapPoints.length > 1 ? maxH - heights[topIndex - 1] : 1;
  const backdropOpacity = useTransform(y, [0, Math.max(backdropFrom, 1)], [0.18, 0], { clamp: true });

  // Measure the container (the sheet's frame fills it).
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setContainerH(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Place the sheet at its snap without animating on first measure / resize.
  const placed = useRef(false);
  useLayoutEffect(() => {
    if (!containerH) return;
    if (!placed.current) {
      y.set(yFor(index));
      placed.current = true;
    }
  }, [containerH, index, y, yFor]);

  const settle = useCallback(
    (target: number, velocity = 0, onDone?: () => void) => {
      animate(y, target, reduce ? { ...fadeUI, duration: 0.15 } : { ...springSheet, velocity, onComplete: onDone });
      if (reduce) onDone?.();
    },
    [y, reduce],
  );

  const goTo = useCallback(
    (i: number, velocity = 0) => {
      const next = Math.max(0, Math.min(topIndex, i));
      if (next !== index) haptic("tick");
      setIndex(next);
      onSnapChange?.(next);
      settle(yFor(next), velocity);
    },
    [index, onSnapChange, settle, topIndex, yFor],
  );

  // Controlled mode: adopt a new `snap` prop during render, then animate to it.
  const [prevSnap, setPrevSnap] = useState(snap);
  if (snap !== undefined && snap !== prevSnap) {
    setPrevSnap(snap);
    setIndex(snap);
  }
  useEffect(() => {
    if (snap === undefined || !placed.current) return;
    settle(yFor(snap));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap]);

  // Keep position correct when the container resizes (rotation, keyboard).
  useEffect(() => {
    if (placed.current && containerH) y.set(yFor(index));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerH]);

  // Reset content scroll whenever we leave the top snap, so the next expand starts at the top.
  useEffect(() => {
    if (!atTop && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [atTop]);

  const startDrag = (e: ReactPointerEvent) => controls.start(e);

  const onContentPointerDown = (e: ReactPointerEvent) => {
    // At the top snap the content scrolls; below it, the whole sheet is the drag handle.
    if (!atTop) startDrag(e);
  };

  const lowestY = maxH - heights[0];
  const onDragEnd = (_: unknown, info: { velocity: { y: number } }) => {
    const v = info.velocity.y;
    const projected = y.get() + projectMomentum(v, 0.99);
    if (dismissible && onDismiss && projected > lowestY + heights[0] * 0.5) {
      settle(maxH, v, onDismiss);
      return;
    }
    let best = 0;
    heights.forEach((_, i) => {
      if (Math.abs(yFor(i) - projected) < Math.abs(yFor(best) - projected)) best = i;
    });
    goTo(best, v);
  };

  // Track which snap we are visually nearest while dragging, for the handle's accessible label.
  const [nearTop, setNearTop] = useState(atTop);
  useMotionValueEvent(y, "change", (v) => setNearTop(v < backdropFrom / 2));

  return (
    <div ref={frameRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      {hasBackdrop && (
        <motion.div
          aria-hidden
          className={cn("absolute inset-0 bg-scrim", atTop ? "pointer-events-auto" : "pointer-events-none")}
          style={{ opacity: backdropOpacity }}
          onClick={() => goTo(topIndex - 1)}
        />
      )}
      <motion.section
        role="region"
        aria-label={aria["aria-label"]}
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragMomentum={false}
        dragConstraints={{ top: 0, bottom: dismissible ? maxH : lowestY }}
        dragElastic={{ top: TOP_RUBBER_BAND, bottom: dismissible ? 0 : TOP_RUBBER_BAND }}
        onDragEnd={onDragEnd}
        onKeyDown={(e) => {
          if (e.key === "Escape" && atTop && topIndex > 0) goTo(topIndex - 1);
        }}
        style={{ y, height: maxH || undefined }}
        className={cn(
          "pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col rounded-t-sheet bg-surface-raised",
          "border-t border-elevated-border shadow-sheet will-change-transform",
          containerH === 0 && "invisible",
          className,
        )}
      >
        <div className="shrink-0 touch-none select-none" onPointerDown={startDrag}>
          <button
            type="button"
            aria-label={nearTop ? "Collapse sheet" : "Expand sheet"}
            onClick={() => goTo(atTop ? 0 : index + 1)}
            className="relative mx-auto flex h-6 w-16 items-center justify-center after:absolute after:-inset-x-2 after:-inset-y-2.5 after:content-['']"
          >
            <span className="h-1 w-9 rounded-full bg-ink-muted/30" />
          </button>
          {header && <div className="px-5 pb-3">{header}</div>}
        </div>
        <div
          ref={scrollRef}
          onPointerDown={onContentPointerDown}
          className={cn(
            "min-h-0 flex-1 px-5 pb-[calc(env(safe-area-inset-bottom)+16px)]",
            atTop ? "overflow-y-auto overscroll-contain" : "touch-none overflow-hidden",
          )}
        >
          {children}
        </div>
      </motion.section>
    </div>
  );
}

function resolve(p: SnapPoint, containerH: number): number {
  if (typeof p === "number") return Math.min(p, containerH || p);
  return (parseFloat(p) / 100) * containerH;
}
