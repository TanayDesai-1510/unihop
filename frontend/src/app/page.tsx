"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_URL, checkHealth, USE_MOCKS } from "@/lib/api";

type Status = "checking" | "up" | "down";

const ROUTES = [
  "/login",
  "/rider",
  "/driver",
  "/driver/onboard",
  "/payment",
  "/payment/add",
  "/history",
  "/earnings",
  "/profile",
];

export default function Home() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;
    checkHealth()
      .then((h) => !cancelled && setStatus(h.status === "ok" ? "up" : "down"))
      .catch(() => !cancelled && setStatus("down"));
    return () => {
      cancelled = true;
    };
  }, []);

  const badge = {
    checking: "bg-zinc-200 text-zinc-700",
    up: "bg-emerald-100 text-emerald-800",
    down: "bg-red-100 text-red-800",
  }[status];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-[env(safe-area-inset-bottom)] pt-[calc(env(safe-area-inset-top)+2rem)]">
      <header>
        <h1 className="text-3xl font-bold text-[#cc0033]">UniHop</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Rutgers campus rides, every ride under $10.</p>
      </header>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">Backend</span>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${badge}`} data-testid="backend-status">
            {status === "checking" ? "Checking…" : status === "up" ? "Online" : "Offline"}
          </span>
        </div>
        <p className="mt-2 break-all text-sm text-zinc-500">{API_URL}/api/health</p>
        <p className="mt-1 text-sm text-zinc-500">
          Data source: <strong>{USE_MOCKS ? "mocks (NEXT_PUBLIC_USE_MOCKS=true)" : "real API"}</strong>
        </p>
      </section>

      <nav className="grid grid-cols-2 gap-2">
        {ROUTES.map((r) => (
          <Link key={r} href={r} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
            {r}
          </Link>
        ))}
      </nav>
    </main>
  );
}
