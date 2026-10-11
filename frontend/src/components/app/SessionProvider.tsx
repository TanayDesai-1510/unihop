"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiRequestError, setToken } from "@/lib/api";
import type { User, UserMode } from "@/lib/types";
import { realtime } from "@/lib/ws";

type SessionStatus = "loading" | "ready" | "error";

interface Session {
  user: User | null;
  status: SessionStatus;
  /** Message to show when status is "error" (network down, server error). */
  error: string | null;
  reload(): void;
  /** Switch Rider/Driver mode. Rejects with ApiRequestError (e.g. 409 DRIVER_NOT_ONBOARDED). */
  setMode(mode: UserMode): Promise<User>;
  setUser(user: User): void;
  signOut(): void;
}

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession must be used inside <SessionProvider>");
  return s;
}

/** Home route for a mode. */
export function homeFor(mode: UserMode): string {
  return mode === "DRIVER" ? "/driver" : "/rider";
}

/**
 * Loads the signed-in user once for every authenticated screen. Screens render immediately and read
 * `status`, so nothing waits on a blank page. A 401 sends the user to /login.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .getMe()
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiRequestError && e.status === 401) {
          setToken(null);
          const next = window.location.pathname + window.location.search;
          router.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
        setError(e instanceof ApiRequestError && e.status === 0 ? e.message : "We couldn't load your account. Try again.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, router]);

  const reload = useCallback(() => {
    setStatus("loading");
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  const setMode = useCallback(async (mode: UserMode) => {
    const updated = await api.updateMe({ mode });
    setUser(updated);
    return updated;
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    realtime.disconnect();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo<Session>(
    () => ({ user, status, error, reload, setMode, setUser, signOut }),
    [user, status, error, reload, setMode, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
