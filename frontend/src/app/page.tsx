"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homeFor } from "@/components/app/SessionProvider";
import { Logo } from "@/components/app/Logo";
import { api, getToken } from "@/lib/api";
import { springState } from "@/lib/motion";

/** Splash: route signed-in users to their mode's home, everyone else to login. */
export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api
      .getMe()
      .then((u) => router.replace(homeFor(u.mode)))
      .catch(() => router.replace("/login"));
  }, [router]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3">
      <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={springState}>
        <Logo size="lg" />
      </motion.div>
      <p className="text-label font-normal text-ink-muted">Every ride under $10. Students only.</p>
    </main>
  );
}
