"use client";
import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-critical — the app works fine without it, just without the
        // install-prompt polish on some Android browsers.
      });
    }
  }, []);
  return null;
}
