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
  /** Visible height (px) of the detent the sheet is heading to. For camera padding behind it. */
  onHeightChange?: (px: number) => void;
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
  onHeightChange,
  dismissible = false,
  onDismiss,
  header,
  children,
  className,
  ...aria
}: BottomSheetProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  /** Marks the sheet as moving (drag or settle) so expensive materials (backdrop blur) can pause. */
  const setMoving = useCallback((moving: boolean) => {
    if (!sheetRef.current) return;
    if (moving) sheetRef.current.dataset.moving = "";
    else delete sheetRef.current.dataset.moving;
  }, []);
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

  // Report the visible height of the detent we're heading to (map camera padding).
  const reportedH = useRef(-1);
  const report = useCallback(
    (i: number) => {
      const h = Math.round(heights[Math.max(0, Math.min(heights.length - 1, i))] ?? 0);
      if (h && h !== reportedH.current) {
        reportedH.current = h;
        onHeightChange?.(h);
      }
    },
    [heights, onHeightChange],
  );

  // Place the sheet at its snap without animating on first measure / resize.
  const placed = useRef(false);
  useLayoutEffect(() => {
    if (!containerH) return;
    if (!placed.current) {
      y.set(yFor(index));
      placed.current = true;
      report(index);
    }
  }, [containerH, index, y, yFor, report]);

  // A state swapped the detents (ride flow): keep the sheet's on-screen edge where it is this
  // frame (no jump), then spring to the matching detent in the new set.
  const snapKey = snapPoints.join("|");
  // New detent set: clamp the index during render (no effect setState).
  const [renderedKey, setRenderedKey] = useState(snapKey);
  if (renderedKey !== snapKey) {
    setRenderedKey(snapKey);
    const clamped = Math.max(0, Math.min(snapPoints.length - 1, snap ?? index));
    if (clamped !== index) setIndex(clamped);
  }
  const prevKey = useRef(snapKey);
  const prevMaxH = useRef(maxH);
  useLayoutEffect(() => {
    if (!placed.current || !containerH) {
      prevKey.current = snapKey;
      prevMaxH.current = maxH;
      return;
    }
    if (prevKey.current === snapKey && prevMaxH.current === maxH) return;
    const keyChanged = prevKey.current !== snapKey;
    y.set(y.get() + (maxH - prevMaxH.current));
    prevKey.current = snapKey;
    prevMaxH.current = maxH;
    if (!keyChanged) return;
    const next = Math.max(0, Math.min(snapPoints.length - 1, index));
    setMoving(true);
    animate(y, maxH - heights[next], reduce ? { ...fadeUI, duration: 0.15 } : springSheet).then(() => setMoving(false));
    report(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapKey, maxH, containerH]);

  const settle = useCallback(
    (target: number, velocity = 0, onDone?: () => void) => {
      setMoving(true);
      animate(y, target, reduce ? { ...fadeUI, duration: 0.15 } : { ...springSheet, velocity }).then(() => {
        setMoving(false);
        onDone?.();
      });
    },
    [y, reduce, setMoving],
  );

  const goTo = useCallback(
    (i: number, velocity = 0) => {
      const next = Math.max(0, Math.min(topIndex, i));
      if (next !== index) haptic("tick");
      setIndex(next);
      onSnapChange?.(next);
      report(next);
      settle(yFor(next), velocity);
    },
    [index, onSnapChange, settle, topIndex, yFor, report],
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
    report(snap);
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
        ref={sheetRef}
        role="region"
        aria-label={aria["aria-label"]}
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragMomentum={false}
        dragConstraints={{ top: 0, bottom: dismissible ? maxH : lowestY }}
        dragElastic={{ top: TOP_RUBBER_BAND, bottom: dismissible ? 0 : TOP_RUBBER_BAND }}
        onDragStart={() => setMoving(true)}
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
        {/* Below full, content dissolves at the bottom edge instead of being sliced. An overlay that
            fades (opacity only), not a mask, so reaching full never forces a re-raster. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface-raised to-transparent transition-opacity duration-200",
            atTop ? "opacity-0" : "opacity-100",
          )}
        />
      </motion.section>
    </div>
  );
}

function resolve(p: SnapPoint, containerH: number): number {
  if (typeof p === "number") return Math.min(p, containerH || p);
  return (parseFloat(p) / 100) * containerH;
}
