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
export function ConnectionBanner() {
  const reduce = useReducedMotion();
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

  return (
    <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center px-5 pt-[calc(env(safe-area-inset-top)+8px)]">
      <AnimatePresence>
        {visible && (
          <motion.div
            role="status"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16 }}
            transition={reduce ? fadeUI : springUI}
            className="flex h-9 items-center gap-2 rounded-full bg-brand px-4 text-label text-on-brand shadow-float"
          >
            {online ? <Spinner size={16} /> : <WifiOff aria-hidden size={20} strokeWidth={2} />}
            {online ? "Reconnecting…" : "You're offline. Reconnecting when you're back."}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
