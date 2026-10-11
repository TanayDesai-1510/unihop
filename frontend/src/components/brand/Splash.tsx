"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { EASE_UI } from "@/lib/motion";
import { Logo } from "./Logo";

export const SPLASH_KEY = "unihop.splash.v1";

/**
 * Runs in <head> before first paint: marks the document when this session already saw the splash,
 * so CSS hides it instantly and repeat visits never flash navy.
 */
export const splashBootScript = `try{if(sessionStorage.getItem("${SPLASH_KEY}"))document.documentElement.dataset.splash="done"}catch(e){document.documentElement.dataset.splash="done"}`;

const HOLD_MS = 620; // scale-in settles, then fade (fade 0.38s): ~1.0s total, under DESIGN.md's 1.2s

/**
 * First load per session: the logo mark on the logo navy (--brand-logo), gentle spring scale-in, then a fade out.
 * The splash uses the white mark rather than the navy icon: navy-on-navy is disallowed in
 * DESIGN.md section 2, and the mark on navy reads exactly like the icon.
 */
export function Splash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Repeat visit: CSS already hides it before first paint; just unmount.
    const seen = document.documentElement.dataset.splash === "done";
    if (!seen) {
      try {
        sessionStorage.setItem(SPLASH_KEY, "1");
      } catch {
        // storage blocked: the splash just plays every load
      }
    }
    const t = setTimeout(() => setVisible(false), seen ? 0 : HOLD_MS);
    return () => clearTimeout(t);
  }, []);

  return <SplashOverlay show={visible} />;
}

/** The visual itself; /dev/components replays it. */
export function SplashOverlay({ show, contained = false }: { show: boolean; contained?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          aria-hidden
          exit={{ opacity: 0 }}
          transition={{ duration: 0.38, ease: EASE_UI }}
          className={`unihop-splash ${contained ? "absolute" : "fixed"} inset-0 z-[100] flex items-center justify-center bg-brand-logo`}
        >
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduce ? { duration: 0.2 } : { type: "spring", bounce: 0.25, visualDuration: 0.45 }}
          >
            <Logo variant="mark" onBrand size={112} priority />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
