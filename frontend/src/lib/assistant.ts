const DRIVER_WATCH_KEY = "unihop.assistant.driver-watch";

export function readDriverWatch(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(DRIVER_WATCH_KEY);
  } catch {
    return null;
  }
}

export function saveDriverWatch(hubId: string): void {
  try {
    window.sessionStorage.setItem(DRIVER_WATCH_KEY, hubId);
  } catch {
    // A blocked session store keeps the watch active in memory for this page.
  }
}

export function removeDriverWatch(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DRIVER_WATCH_KEY);
  } catch {
    // Nothing else to clear.
  }
}
