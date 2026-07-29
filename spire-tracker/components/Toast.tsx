"use client";
import { useEffect, useState } from "react";

let externalSetter: ((msg: string) => void) | null = null;

export function showToast(msg: string) {
  externalSetter?.(msg);
}

export default function Toast() {
  const [msg, setMsg] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    externalSetter = (m: string) => {
      setMsg(m);
      setVisible(true);
      window.clearTimeout((window as any).__toastTimer);
      (window as any).__toastTimer = window.setTimeout(() => setVisible(false), 2200);
    };
    return () => {
      externalSetter = null;
    };
  }, []);

  return <div className={`toast ${visible ? "show" : ""}`}>{msg}</div>;
}
