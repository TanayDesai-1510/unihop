"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface TabsChrome {
  navHidden: boolean;
  setNavHidden(hidden: boolean): void;
}

const Ctx = createContext<TabsChrome>({ navHidden: false, setNavHidden: () => {} });

/** Lets a tab screen hide the bottom nav (DESIGN.md section 5: hidden during an active ride). */
export function TabsChromeProvider({ children }: { children: ReactNode }) {
  const [navHidden, setNavHidden] = useState(false);
  const value = useMemo(() => ({ navHidden, setNavHidden }), [navHidden]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTabsChrome(): TabsChrome {
  return useContext(Ctx);
}

/** Hides the nav while `hidden` is true; restores it on unmount. */
export function useHideNav(hidden: boolean): void {
  const { setNavHidden } = useTabsChrome();
  useEffect(() => {
    setNavHidden(hidden);
    return () => setNavHidden(false);
  }, [hidden, setNavHidden]);
}
