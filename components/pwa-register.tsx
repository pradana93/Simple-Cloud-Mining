"use client";
import { useEffect } from "react";

// Registers the service worker after first paint so it never competes with the
// initial render. Silent on failure: the app works fine without it.
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }, 1500);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
