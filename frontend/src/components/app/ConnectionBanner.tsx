"use client";

import { WifiOff } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { fadeUI, springUI } from "@/lib/motion";
import { realtime, type ConnectionState } from "@/lib/ws";

/** Waits this long before showing, so a quick blip doesn't flash a banner. */
const SHOW_AFTER_MS = 1200;

/**
 * "Reconnecting" banner for WebSocket drops and offline devices (DESIGN.md section 10).
 * Overlays the top of the screen instead of pushing content down, so nothing shifts.
 */
/**
 * True once the realtime socket has been down (or the device offline) for SHOW_AFTER_MS.
 * `offline` distinguishes "no network" from "server unreachable".
 */
export function useConnectionProblem(): { problem: boolean; offline: boolean } {
  const [ws, setWs] = useState<ConnectionState>("idle");
  const [online, setOnline] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => realtime.onConnectionChange(setWs), []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const problem = !online || ws === "disconnected";
  useEffect(() => {
    if (!problem) return;
    const t = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => {
      clearTimeout(t);
      setVisible(false);
    };
  }, [problem]);

  return { problem: visible, offline: !online };
}

/**
 * "Reconnecting" banner for WebSocket drops and offline devices (DESIGN.md section 10).
 * Overlays the top of the screen instead of pushing content down, so nothing shifts. Sits above
 * the map screens' chrome (600/700) and below modal sheets (900); on map screens it drops below
 * the floating top bar (`.connection-banner` rules in globals.css).
 */
export function ConnectionBanner() {
  const reduce = useReducedMotion();
  const { problem: visible, offline } = useConnectionProblem();
  const online = !offline;

  return (
    <div aria-live="polite" className="connection-banner pointer-events-none absolute inset-x-0 top-0 z-[800] flex justify-center px-5 pt-[calc(env(safe-area-inset-top)+8px)]">
      <AnimatePresence>
        {visible && (
          <motion.div
            role="status"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16 }}
            transition={reduce ? fadeUI : springUI}
            className="flex min-h-9 items-center gap-2 rounded-full py-1.5 bg-brand px-4 text-label text-on-brand shadow-float"
          >
            {online ? <Spinner size={16} /> : <WifiOff aria-hidden size={20} strokeWidth={2} />}
            {online ? "Reconnecting…" : "You're offline"}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
